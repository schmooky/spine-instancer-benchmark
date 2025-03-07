import { Application, Assets } from 'pixi.js';
import { AssetLoader } from './AssetLoader';
import { BenchmarkScene } from './lib/BenchmarkScene';
import { BenchmarkUI } from './BenchmarkUI';
import { initSpineInstancing, SpineInstancer } from './lib/SpineInstancer';

export class App {
  private app!: Application;
  private instancer: SpineInstancer | null = null;
  private benchmarkScene: BenchmarkScene | null = null;
  private benchmarkUI: BenchmarkUI | null = null;
  private isLoading: boolean = false;
  private loadingOverlay: HTMLElement | null = null;
  
  constructor() {
    try {
      // Create application with preferred renderer types
      this.app = new Application();
      this.app.init({
        view: document.getElementById('pixi-canvas') as HTMLCanvasElement,
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        backgroundColor: 0x121212,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        preference: 'webgl',  // Prefer WebGL for better compatibility
      }).then(()=>{
         // Handle resize
      window.addEventListener('resize', this.onResize.bind(this));
      
      // Log renderer information
      console.log('Renderer type:', this.app.renderer.type);
      console.log('Renderer:', this.app.renderer);
      
      // Initialize spine instancer
      try {
        this.instancer = initSpineInstancing(this.app.renderer);
        console.log('SpineInstancer initialized:', this.instancer ? 'Success' : 'Failed');
      } catch (error) {
        console.error('Failed to initialize SpineInstancer:', error);
        this.instancer = null;
      }
      
      // Create loading overlay
      this.createLoadingOverlay();
      
      // Start loading assets
      this.loadAssets();
      })
      
     
    } catch (error) {
      console.error('Failed to initialize PIXI application:', error);
      this.showRenderError();
    }
  }
  
  private showRenderError(): void {
    // Create error message element
    const errorContainer = document.createElement('div');
    errorContainer.style.position = 'fixed';
    errorContainer.style.top = '0';
    errorContainer.style.left = '0';
    errorContainer.style.width = '100%';
    errorContainer.style.height = '100%';
    errorContainer.style.backgroundColor = '#222';
    errorContainer.style.color = 'white';
    errorContainer.style.display = 'flex';
    errorContainer.style.flexDirection = 'column';
    errorContainer.style.justifyContent = 'center';
    errorContainer.style.alignItems = 'center';
    errorContainer.style.textAlign = 'center';
    errorContainer.style.padding = '20px';
    errorContainer.style.fontFamily = 'Arial, sans-serif';
    errorContainer.style.zIndex = '1000';
    
    const errorTitle = document.createElement('h2');
    errorTitle.textContent = 'WebGL not supported';
    errorTitle.style.marginBottom = '20px';
    errorTitle.style.color = '#ff5555';
    
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'Your browser does not support WebGL, which is required for this application.';
    errorMessage.style.marginBottom = '20px';
    
    const errorHelp = document.createElement('p');
    errorHelp.innerHTML = 'Please try using a modern browser like <a href="https://www.google.com/chrome/" style="color: #4fc3f7;">Chrome</a>, <a href="https://www.mozilla.org/firefox/" style="color: #4fc3f7;">Firefox</a>, or <a href="https://www.apple.com/safari/" style="color: #4fc3f7;">Safari</a>.';
    errorHelp.style.marginBottom = '30px';
    
    const errorDetails = document.createElement('details');
    errorDetails.style.maxWidth = '600px';
    errorDetails.style.textAlign = 'left';
    errorDetails.style.backgroundColor = '#333';
    errorDetails.style.padding = '10px';
    errorDetails.style.borderRadius = '5px';
    
    const errorSummary = document.createElement('summary');
    errorSummary.textContent = 'Technical Details';
    errorSummary.style.cursor = 'pointer';
    errorSummary.style.padding = '10px';
    
    const errorCode = document.createElement('pre');
    errorCode.textContent = `Browser: ${navigator.userAgent}\nWebGL: ${window.WebGLRenderingContext ? 'Supported' : 'Not Supported'}\nCanvas: ${document.createElement('canvas').getContext ? 'Supported' : 'Not Supported'}`;
    errorCode.style.backgroundColor = '#222';
    errorCode.style.padding = '10px';
    errorCode.style.borderRadius = '3px';
    errorCode.style.overflowX = 'auto';
    
    errorDetails.appendChild(errorSummary);
    errorDetails.appendChild(errorCode);
    
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorMessage);
    errorContainer.appendChild(errorHelp);
    errorContainer.appendChild(errorDetails);
    
    document.body.appendChild(errorContainer);
  }
  
  private onResize(): void {
    // Resize the renderer
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
  }
  
  private createLoadingOverlay(): void {
    // Create loading overlay
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'loading-overlay';
    
    // Create loading content
    const loadingContent = document.createElement('div');
    loadingContent.className = 'loading-content';
    
    // Create loading text
    const loadingText = document.createElement('h2');
    loadingText.textContent = 'Loading Assets...';
    
    // Create loading bar container
    const loadingBarContainer = document.createElement('div');
    loadingBarContainer.className = 'loading-bar-container';
    
    // Create loading bar
    const loadingBar = document.createElement('div');
    loadingBar.className = 'loading-bar';
    loadingBar.id = 'loading-bar';
    
    // Create loading percentage text
    const loadingPercentage = document.createElement('div');
    loadingPercentage.className = 'loading-percentage';
    loadingPercentage.id = 'loading-percentage';
    loadingPercentage.textContent = '0%';
    
    // Add elements to their parents
    loadingBarContainer.appendChild(loadingBar);
    loadingContent.appendChild(loadingText);
    loadingContent.appendChild(loadingBarContainer);
    loadingContent.appendChild(loadingPercentage);
    this.loadingOverlay.appendChild(loadingContent);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        color: white;
        font-family: sans-serif;
      }
      .loading-content {
        width: 80%;
        max-width: 600px;
        text-align: center;
      }
      .loading-bar-container {
        width: 100%;
        height: 20px;
        background-color: #333;
        border-radius: 10px;
        margin-top: 20px;
        overflow: hidden;
      }
      .loading-bar {
        height: 100%;
        width: 0%;
        background-color: #2a64e2;
        transition: width 0.3s ease;
      }
      .loading-percentage {
        margin-top: 10px;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.loadingOverlay);
  }
  
  private updateLoadingProgress(progress: number): void {
    if (!this.loadingOverlay) return;
    
    const loadingBar = document.getElementById('loading-bar');
    const loadingPercentage = document.getElementById('loading-percentage');
    
    if (loadingBar && loadingPercentage) {
      const percentage = Math.round(progress * 100);
      loadingBar.style.width = `${percentage}%`;
      loadingPercentage.textContent = `${percentage}%`;
    }
  }
  
  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      // Fade out and remove
      this.loadingOverlay.style.transition = 'opacity 0.5s ease';
      this.loadingOverlay.style.opacity = '0';
      
      setTimeout(() => {
        if (this.loadingOverlay && this.loadingOverlay.parentNode) {
          this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
        }
        this.loadingOverlay = null;
      }, 500);
    }
  }
  
  private async loadAssets(): Promise<void> {
    this.isLoading = true;
    
    try {
      // Load spine assets
      const spineData = await AssetLoader.loadSpineCharacter('god', (progress) => {
        this.updateLoadingProgress(progress.progress);
      });

      console.log(Assets.cache)
      
      // Hide loading overlay
      this.hideLoadingOverlay();
      
      // Create benchmark scene
      this.benchmarkScene = new BenchmarkScene(this.app, this.instancer);
      this.benchmarkScene.setSpineData(spineData);
      
      // Create UI
      this.benchmarkUI = new BenchmarkUI(this.benchmarkScene);
      
      // Generate initial scene
      this.benchmarkScene.generateScene();
      
      // Start application loop
      this.app.ticker.add((ticker)=>this.update(ticker.deltaMS));
      
      this.isLoading = false;
    } catch (error) {
      console.error('Failed to load assets:', error);
      this.isLoading = false;
      
      // Update loading overlay
      if (this.loadingOverlay) {
        const loadingText = this.loadingOverlay.querySelector('h2');
        if (loadingText) {
          loadingText.textContent = 'Failed to load assets!';
          loadingText.style.color = 'red';
        }
      }
    }
  }
  
  private update(deltaMS: number): void {
    if (this.isLoading) return;
    
    // Calculate deltaTime in seconds (since Spine animations use seconds)
    const deltaTime = deltaMS / 1000;
    
    // Update benchmark scene
    if (this.benchmarkScene) {
      this.benchmarkScene.update(deltaTime);
    }
    
    // Update UI
    if (this.benchmarkUI) {
      this.benchmarkUI.update();
    }
  }
  
  public destroy(): void {
    // Clean up resources
    window.removeEventListener('resize', this.onResize.bind(this));
    
    // Destroy benchmark scene
    if (this.benchmarkScene) {
      this.benchmarkScene.destroy();
    }
    
    // Destroy UI
    if (this.benchmarkUI) {
      this.benchmarkUI.destroy();
    }
    
    // Destroy PIXI app
    this.app.destroy(true, { children: true });
  }
}