import './style.css';
import { App } from './App';

// Check WebGL support before initializing
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// Show error message if WebGL is not supported
function showWebGLError() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.backgroundColor = '#222';
  container.style.color = '#fff';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.zIndex = '9999';
  container.style.textAlign = 'center';
  container.style.padding = '20px';
  
  const heading = document.createElement('h1');
  heading.textContent = 'WebGL Not Supported';
  heading.style.color = '#ff5555';
  
  const message = document.createElement('p');
  message.textContent = 'Your browser does not support WebGL, which is required for this application.';
  message.style.maxWidth = '600px';
  message.style.marginBottom = '20px';
  
  container.appendChild(heading);
  container.appendChild(message);
  
  document.body.appendChild(container);
}

// Initialize the application
function init() {
  try {
    // Create application instance
    const app = new App();
    
    // Export app for debugging
    (window as any).__app = app;
  } catch (error) {
    console.error('Failed to initialize application:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: white; text-align: center;">
        <h2>Application Initialization Error</h2>
        <p>An error occurred while initializing the application. Please check the console for details.</p>
        <pre style="background: #333; padding: 10px; text-align: left; max-width: 800px; margin: 0 auto; overflow: auto;">${error}</pre>
      </div>
    `;
  }
}

// Check WebGL support and initialize
if (isWebGLSupported()) {
  init();
} else {
  showWebGLError();
}