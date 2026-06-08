<?php
/**
 * LLM API 客户端 — 支持 DeepSeek / OpenAI / Claude
 *
 * 使用系统 curl 命令行工具实现，无需 PHP cURL 或 OpenSSL 扩展。
 * 配置通过主站 config.php 中的 LLM_* 常量读取。
 */

class LLMClient {
    private string $provider;
    private string $apiKey;
    private string $apiUrl;
    private string $model;
    private string $proxy;
    private int $maxTokens;
    private float $temperature;
    private ?string $lastRawResponse = null;
    private ?string $lastErrorType = null;
    private ?string $lastFinishReason = null;
    private ?int $lastHttpStatus = null;

    public function __construct() {
        $this->provider = defined('LLM_PROVIDER') ? LLM_PROVIDER : 'deepseek';
        $this->apiKey = defined('LLM_API_KEY') ? LLM_API_KEY : '';
        $this->apiUrl = $this->resolveApiUrl();
        $this->model = defined('LLM_MODEL') ? LLM_MODEL : $this->getDefaultModel();
        $this->proxy = defined('LLM_PROXY') ? trim((string)LLM_PROXY) : '';
        $this->maxTokens = defined('LLM_MAX_TOKENS') ? (int)LLM_MAX_TOKENS : 2048;
        $this->temperature = defined('LLM_TEMPERATURE') ? (float)LLM_TEMPERATURE : 0.7;
    }

    /**
     * 检查 LLM 是否可用
     */
    public function isAvailable(): bool {
        return defined('LLM_ENABLED') && LLM_ENABLED && $this->apiKey !== '';
    }

    /**
     * 调用 LLM 并返回解析后的 JSON
     * @param array $messages 消息列表 [['role' => 'system'|'user'|'assistant', 'content' => '...']]
     * @return array|null 解析后的关联数组，失败返回 null
     */
    public function chat(array $messages): ?array {
        $this->lastRawResponse = null;
        $this->lastErrorType = null;
        $this->lastFinishReason = null;
        $this->lastHttpStatus = null;

        if (!$this->isAvailable()) {
            $this->lastErrorType = 'not_configured';
            return null;
        }

        $payload = $this->buildPayload($messages);
        if ($payload === null) {
            $this->lastErrorType = 'payload_build_failed';
            return null;
        }

        $response = $this->doRequest($payload);
        if ($response === null) {
            $this->lastErrorType ??= 'transport_failed';
            return null;
        }

        $this->lastRawResponse = $response;
        return $this->extractJson($response);
    }

    public function getLastRawResponse(): ?string {
        return $this->lastRawResponse;
    }

    public function getLastErrorType(): ?string {
        return $this->lastErrorType;
    }

    public function getLastFinishReason(): ?string {
        return $this->lastFinishReason;
    }

    public function getLastHttpStatus(): ?int {
        return $this->lastHttpStatus;
    }

    private function resolveApiUrl(): string {
        if (defined('LLM_API_URL') && LLM_API_URL !== '') {
            return LLM_API_URL;
        }
        return match ($this->provider) {
            'openai' => 'https://api.openai.com/v1/chat/completions',
            'claude' => 'https://api.anthropic.com/v1/messages',
            default => 'https://api.deepseek.com/v1/chat/completions',
        };
    }

    private function getDefaultModel(): string {
        return match ($this->provider) {
            'openai' => 'gpt-4o-mini',
            'claude' => 'claude-sonnet-4-20250514',
            default => 'deepseek-chat',
        };
    }

    /**
     * 根据 provider 构建请求 payload
     */
    private function buildPayload(array $messages): ?array {
        return match ($this->provider) {
            'claude' => [
                'model' => $this->model,
                'max_tokens' => $this->maxTokens,
                'temperature' => $this->temperature,
                'messages' => $messages,
            ],
            default => [
                'model' => $this->model,
                'max_tokens' => $this->maxTokens,
                'temperature' => $this->temperature,
                'messages' => $messages,
                'response_format' => ['type' => 'json_object'],
            ],
        };
    }

    /**
     * 执行 HTTP 请求（三级 fallback 链）
     *
     * 优先级：
     * 1. PHP curl_* 函数（extension_loaded 检查）
     * 2. shell_exec + 系统 curl（无需 PHP 扩展）
     * 3. file_get_contents + stream context（allow_url_fopen 兜底）
     */
    private function doRequest(array $payload): ?string {
        $headers = $this->buildHeaders();
        if ($headers === null) {
            return null;
        }

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return null;
        }

        // 三级 fallback 链
        if (extension_loaded('curl')) {
            $result = $this->doRequestCurl($json, $headers);
            if ($result !== null) return $result;
            error_log('LLM: PHP curl failed, trying shell_exec fallback');
        }

        if (function_exists('shell_exec')) {
            $result = $this->doRequestShellExec($json, $headers);
            if ($result !== null) return $result;
            error_log('LLM: shell_exec failed, trying stream_context fallback');
        }

        $result = $this->doRequestStream($json, $headers);
        if ($result !== null) return $result;

        error_log('LLM: all transport methods failed');
        return null;
    }

    /**
     * 使用 PHP curl 扩展发送请求
     */
    private function doRequestCurl(string $json, array $headers): ?string {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $this->apiUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $this->lastHttpStatus = (int)$httpCode;
        $error = curl_error($ch);
        // PHP 8.5+ automatically frees the handle; curl_close is deprecated

        if ($response === false || $response === '') {
            error_log("LLM curl failed: {$error}");
            $this->lastErrorType = 'empty_response';
            return null;
        }
        if ($httpCode !== 200) {
            error_log("LLM curl HTTP {$httpCode}: " . substr($response, 0, 500));
            $this->lastErrorType = 'http_' . $httpCode;
            return null;
        }
        return $response;
    }

    /**
     * 使用 shell_exec + 系统 curl 命令行发送请求
     */
    private function doRequestShellExec(string $json, array $headers): ?string {
        $dataFile = tempnam(sys_get_temp_dir(), 'llm_req_');
        $outFile = tempnam(sys_get_temp_dir(), 'llm_res_');
        file_put_contents($dataFile, $json);

        $headerArgs = '';
        foreach ($headers as $h) {
            $headerArgs .= '-H ' . escapeshellarg($h) . ' ';
        }

        $proxyArg = $this->proxy !== ''
            ? ' -x ' . escapeshellarg($this->proxy)
            : ' --noproxy ' . escapeshellarg('*');

        $cmd = $this->buildCleanProxyEnvPrefix()
             . "curl -s -o " . escapeshellarg($outFile)
             . " -w \"%{http_code}\" -m 30 {$headerArgs}"
             . $proxyArg
             . " -d @" . escapeshellarg($dataFile) . " "
             . escapeshellarg($this->apiUrl) . " 2>&1";

        $httpCode = trim(shell_exec($cmd) ?? '');
        $this->lastHttpStatus = ctype_digit($httpCode) ? (int)$httpCode : null;
        $response = file_get_contents($outFile);

        @unlink($dataFile);
        @unlink($outFile);

        if ($response === false || $response === '') {
            error_log("LLM shell_exec: empty response, HTTP {$httpCode}");
            $this->lastErrorType = 'empty_response';
            return null;
        }
        if ($httpCode !== '200') {
            error_log("LLM shell_exec HTTP {$httpCode}: " . substr($response, 0, 500));
            $this->lastErrorType = 'http_' . $httpCode;
            return null;
        }
        return $response;
    }

    /**
     * 使用 file_get_contents + stream context 发送请求
     */
    private function doRequestStream(string $json, array $headers): ?string {
        $httpOptions = [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $json,
            'timeout' => 30,
            'ignore_errors' => true,
        ];

        if ($this->proxy !== '') {
            $httpOptions['proxy'] = $this->normalizeProxyForStream($this->proxy);
            $httpOptions['request_fulluri'] = true;
        }

        $context = stream_context_create([
            'http' => $httpOptions,
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $response = @file_get_contents($this->apiUrl, false, $context);
        if ($response === false || $response === '') {
            error_log('LLM stream: empty response');
            $this->lastErrorType = 'empty_response';
            return null;
        }
        $responseHeaders = function_exists('http_get_last_response_headers')
            ? (http_get_last_response_headers() ?: [])
            : [];
        foreach ($responseHeaders as $header) {
                if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
                    $this->lastHttpStatus = (int)$matches[1];
                    if ($this->lastHttpStatus !== 200) {
                        $this->lastErrorType = 'http_' . $this->lastHttpStatus;
                        return null;
                    }
                    break;
                }
        }
        return $response;
    }

    private function buildCleanProxyEnvPrefix(): string {
        if (PHP_OS_FAMILY === 'Windows') {
            return 'set HTTP_PROXY=& set HTTPS_PROXY=& set ALL_PROXY=& set http_proxy=& set https_proxy=& set all_proxy=& ';
        }
        return 'HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= http_proxy= https_proxy= all_proxy= ';
    }

    private function normalizeProxyForStream(string $proxy): string {
        if (strncmp($proxy, 'tcp://', 6) === 0) {
            return $proxy;
        }
        return preg_replace('/^https?:\/\//', 'tcp://', $proxy) ?: $proxy;
    }

    /**
     * 根据 provider 构建请求头
     */
    private function buildHeaders(): ?array {
        return match ($this->provider) {
            'claude' => [
                'Content-Type: application/json',
                'x-api-key: ' . $this->apiKey,
                'anthropic-version: 2023-06-01',
            ],
            default => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
        };
    }

    /**
     * 从 LLM 响应中提取 JSON
     * 兼容两种格式：
     * 1. 直接返回 JSON（response_format: json_object）
     * 2. markdown 代码块包裹的 JSON（```json ... ```）
     */
    private function extractJson(string $responseBody): ?array {
        $data = json_decode($responseBody, true);
        if ($data === null) {
            $this->lastErrorType = 'response_json_decode_failed';
            return null;
        }

        $this->lastFinishReason = $data['choices'][0]['finish_reason'] ?? null;
        if ($this->lastFinishReason === 'length' || $this->lastFinishReason === 'max_tokens') {
            $this->lastErrorType = 'finish_reason_length';
            return null;
        }

        // 提取 content 文本
        $content = null;
        if (isset($data['choices'][0]['message']['content'])) {
            // DeepSeek / OpenAI 格式
            $content = $data['choices'][0]['message']['content'];
        } elseif (isset($data['content'][0]['text'])) {
            // Claude 格式
            $content = $data['content'][0]['text'];
        } else {
            $this->lastErrorType = 'missing_content';
            return null;
        }

        // 尝试直接解析 content 为 JSON
        $parsed = json_decode($content, true);
        if ($parsed !== null) {
            return $parsed;
        }

        // 尝试从 markdown 代码块中提取 JSON
        if (preg_match('/```(?:json)?\s*([\s\S]*?)```/', $content, $matches)) {
            $parsed = json_decode(trim($matches[1]), true);
            if ($parsed !== null) {
                return $parsed;
            }
        }

        $this->lastErrorType = 'json_parse_failed';
        return null;
    }
}
