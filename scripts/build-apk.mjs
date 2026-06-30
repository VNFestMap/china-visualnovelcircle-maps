/**
 * Build an Android debug APK for the static client.
 */

import { execSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { buildWww } from './build-www.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const ANDROID_DIR = join(ROOT, 'android');

function run(command, options = {}) {
  execSync(command, { cwd: ROOT, stdio: 'inherit', ...options });
}

function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  return pkg.version || '1.0.0';
}

function versionToCode(version) {
  const [major = 0, minor = 0, patch = 0] = version
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

function ensureAndroidProject() {
  if (existsSync(join(ANDROID_DIR, 'app', 'build.gradle'))) return;

  console.log('Android project is missing; creating it with Capacitor...');
  run('npx cap add android');
}

function syncAndroidVersion() {
  const gradlePath = join(ANDROID_DIR, 'app', 'build.gradle');
  if (!existsSync(gradlePath)) return;

  const versionName = getPackageVersion();
  const versionCode = versionToCode(versionName);
  let gradle = readFileSync(gradlePath, 'utf8');
  gradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
  writeFileSync(gradlePath, gradle);
  console.log(`Android versionName=${versionName}, versionCode=${versionCode}`);
}

function allowNonAsciiAndroidPath() {
  const propertiesPath = join(ANDROID_DIR, 'gradle.properties');
  if (!existsSync(propertiesPath)) return;

  const content = readFileSync(propertiesPath, 'utf8');
  if (content.includes('android.overridePathCheck=true')) return;

  writeFileSync(propertiesPath, `${content.trimEnd()}\nandroid.overridePathCheck=true\n`);
  console.log('Enabled Android Gradle path override for this workspace path.');
}

function syncAndroidIcons() {
  const iconSource = join(ROOT, 'images', 'logo.png');
  if (!existsSync(iconSource)) return;

  const mipmapDirs = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  const iconNames = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];

  for (const dir of mipmapDirs) {
    const destDir = join(ANDROID_DIR, 'app', 'src', 'main', 'res', dir);
    mkdirSync(destDir, { recursive: true });
    for (const iconName of iconNames) {
      copyFileSync(iconSource, join(destDir, iconName));
    }
  }
  console.log('Android launcher icons synced.');
}

function patchAndroidSslForBackendIp() {
  const activityPath = join(ANDROID_DIR, 'app', 'src', 'main', 'java', 'top', 'vnfest', 'map', 'MainActivity.java');
  if (!existsSync(activityPath)) return;

  const patched = `package top.vnfest.map;

import android.net.http.SslError;
import android.os.Bundle;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
  private static final String BACKEND_HOST = "162.251.93.178";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    allowBackendIpCertificateForTestPackage();
  }

  private void allowBackendIpCertificateForTestPackage() {
    Bridge currentBridge = getBridge();
    if (currentBridge == null) return;

    currentBridge.setWebViewClient(new BridgeWebViewClient(currentBridge) {
      @Override
      public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        String url = error != null && error.getUrl() != null ? error.getUrl() : "";
        if (url.startsWith("https://" + BACKEND_HOST + "/")) {
          handler.proceed();
          return;
        }
        super.onReceivedSslError(view, handler, error);
      }
    });
  }
}
`;

  const current = readFileSync(activityPath, 'utf8');
  if (current === patched) return;
  writeFileSync(activityPath, patched, 'utf8');
  console.log('Android MainActivity patched to allow the backend IP certificate for test builds.');
}

function configureGradleDistribution() {
  const wrapperProperties = join(ANDROID_DIR, 'gradle', 'wrapper', 'gradle-wrapper.properties');
  if (!existsSync(wrapperProperties)) return;

  let content = readFileSync(wrapperProperties, 'utf8');
  const match = content.match(/gradle-([0-9.]+)-(all|bin)\.zip/);
  if (!match) return;

  const version = match[1];
  const cachedAllDir = join(homedir(), '.gradle', 'wrapper', 'dists', `gradle-${version}-all`);
  const hasCachedAll = existsSync(cachedAllDir);
  const classifier = hasCachedAll ? 'all' : 'bin';
  const next = content.replace(/gradle-([0-9.]+)-(all|bin)\.zip/g, `gradle-$1-${classifier}.zip`);

  if (next !== content) {
    writeFileSync(wrapperProperties, next);
    console.log(`Gradle wrapper distribution switched to ${classifier}.`);
  }
}

buildWww();
ensureAndroidProject();
configureGradleDistribution();
allowNonAsciiAndroidPath();

console.log('Syncing Capacitor Android project...');
run('npx cap sync android');

syncAndroidVersion();
syncAndroidIcons();
patchAndroidSslForBackendIp();

console.log('Building Android debug APK...');
const env = { ...process.env, ANDROID_HOME: process.env.ANDROID_HOME || 'C:/Android' };
const jdkCandidates = [
  'C:/Java/jdk-17.0.14+7',
  'C:/Program Files/Java/jdk-17',
  'C:/Program Files/Eclipse Adoptium/jdk-17',
];

for (const jdk of jdkCandidates) {
  if (existsSync(jdk)) {
    env.JAVA_HOME = jdk;
    break;
  }
}

if (process.platform === 'win32') {
  execSync('gradlew.bat assembleDebug', { cwd: ANDROID_DIR, stdio: 'inherit', shell: 'cmd.exe', env });
} else {
  execSync('./gradlew assembleDebug', { cwd: ANDROID_DIR, stdio: 'inherit', env });
}

console.log('\nAPK build complete!');
console.log('Output: ' + join(ANDROID_DIR, 'app/build/outputs/apk/debug/app-debug.apk'));
