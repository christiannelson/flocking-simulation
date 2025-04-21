// Minimal Puppeteer smoke test for flocking simulation
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');

// Configuration constants
const SERVER_PORT = 5000;
const SERVER_START_TIMEOUT = 8000;
const BROWSER_LAUNCH_TIMEOUT = 30000;
const INITIALIZATION_WAIT_TIME = 2000;

/**
 * Extracts the port number from the server startup output
 * @param {string} output - Server startup output
 * @returns {number|null} - Port number or null if not found
 */
function parseServePort(output) {
  const match = output.match(/Accepting connections at http:\/\/localhost:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Waits for the server to be ready to accept connections
 * @param {Function} getUrl - Function that returns the server URL
 * @param {Function} getPort - Function that returns the server port
 * @param {number} timeout - Maximum time to wait in ms
 */
function waitForServerReady(getUrl, getPort, timeout = SERVER_START_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    function check() {
      const port = getPort();
      if (!port) {
        if (Date.now() - start > timeout) {
          return reject(new Error('Server port not detected in time'));
        }
        setTimeout(check, 200);
        return;
      }

      http.get(getUrl(), res => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    }

    function retry() {
      if (Date.now() - start > timeout) {
        reject(new Error('Server did not start in time'));
      } else {
        setTimeout(check, 300);
      }
    }

    check();
  });
}

/**
 * Sets up and starts the static file server
 * @returns {Object} - Server process and port detection functions
 */
function setupServer() {
  const server = spawn('npx', ['serve', '.', '-l', SERVER_PORT], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  let detectedPort = null;

  server.stdout.on('data', data => {
    const str = data.toString();
    serverOutput += str;
    if (!detectedPort) {
      const port = parseServePort(str);
      if (port) detectedPort = port;
    }
  });

  server.stderr.on('data', data => {
    serverOutput += data.toString();
  });

  return {
    server,
    serverOutput,
    getPort: () => detectedPort,
    getUrl: () => detectedPort ? `http://localhost:${detectedPort}/` : null
  };
}

/**
 * Configures and launches the Puppeteer browser
 * @returns {Promise<Object>} - Browser instance
 */
async function launchBrowser() {
  return await puppeteer.launch({
    headless: false,
    args: [
      '--enable-webgl',
      '--disable-web-security',
      '--no-sandbox'
    ],
    timeout: BROWSER_LAUNCH_TIMEOUT
  });
}

/**
 * Sets up page event listeners and test state tracking
 * @param {Object} page - Puppeteer page object
 * @returns {Object} - Test state tracking object
 */
function setupPageListeners(page) {
  const testState = {
    errorOccurred: false,
    initializationSuccessful: false,
    animationLoopStarted: false
  };

  // Enhanced capture of browser console output
  page.on('console', async msg => {
    const type = msg.type();
    const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => '[unserializable]')));
    const message = args.join(' ');
    console.log(`[browser console.${type}]`, ...args);
    
    if (type === 'error' && message.trim().length > 0) {
      testState.errorOccurred = true;
    }
    
    if (message.includes('Simulation initialized successfully')) {
      testState.initializationSuccessful = true;
    }
    if (message.includes('starting animation loop')) {
      testState.animationLoopStarted = true;
    }
  });

  // Error event handlers
  const errorHandlers = {
    pageerror: err => logError('[browser pageerror]', err),
    error: err => logError('[browser error]', err),
    requestfailed: request => {
      console.error('[browser requestfailed]', {
        url: request.url(),
        method: request.method(),
        failure: request.failure(),
        resourceType: request.resourceType()
      });
    }
  };

  function logError(prefix, err) {
    testState.errorOccurred = true;
    if (err && typeof err === 'object') {
      console.error(prefix, {
        message: err.message,
        stack: err.stack,
        ...err
      });
    } else {
      console.error(prefix, err);
    }
  }

  // Register all error handlers
  Object.entries(errorHandlers).forEach(([event, handler]) => {
    page.on(event, handler);
  });

  return testState;
}

/**
 * Checks and reports the test results
 * @param {Object} testState - Test state tracking object
 */
function reportTestResults(testState) {
  const { errorOccurred, initializationSuccessful, animationLoopStarted } = testState;

  if (!errorOccurred && initializationSuccessful && animationLoopStarted) {
    console.log('PASS: Simulation initialized successfully, animation loop started, and no errors');
  } else {
    console.log('FAIL: Simulation did not initialize properly or encountered errors');
    if (!initializationSuccessful) console.log('  - Simulation initialization failed');
    if (!animationLoopStarted) console.log('  - Animation loop did not start');
    if (errorOccurred) console.log('  - Errors were encountered');
  }
}

/**
 * Main test execution function
 */
async function runSmokeTest() {
  // Setup and start server
  const { server, serverOutput, getPort, getUrl } = setupServer();

  try {
    // Wait for server to be ready
    await waitForServerReady(getUrl, getPort);
    
    // Launch browser and setup page
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const testState = setupPageListeners(page);

    // Navigate to page and wait for initialization
    await page.goto(getUrl(), { waitUntil: 'networkidle0' });
    await page.evaluate(() => new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve);
    }));
    await new Promise(r => setTimeout(r, INITIALIZATION_WAIT_TIME));

    // Capture screenshot and report results
    await page.screenshot({ path: 'smoke-test-out.png' });
    reportTestResults(testState);

    // Cleanup
    await browser.close();
  } catch (error) {
    console.error('[smoke-test] Server did not start:', serverOutput);
    process.exit(1);
  } finally {
    server.kill();
  }
}

// Execute the smoke test
runSmokeTest().catch(error => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
