import Stats from 'stats.js';
import { BenchmarkScene, RenderMode, BenchmarkConfig } from './lib/BenchmarkScene';

export class BenchmarkUI {
  private stats: Stats;
  private benchmarkScene: BenchmarkScene;
  private fpsElement: HTMLElement;
  private drawCallsElement: HTMLElement;
  private activeInstancesElement: HTMLElement;
  private drawCallReductionElement: HTMLElement;
  private memoryUsageElement: HTMLElement;
  private instanceCountSlider: HTMLInputElement;
  private instanceCountValueElement: HTMLElement;
  private instanceModeSelect: HTMLSelectElement;
  private animationTypeSelect: HTMLSelectElement;
  private toggleAnimationsButton: HTMLButtonElement;
  private resetBenchmarkButton: HTMLButtonElement;
  private updateInterval: number | null = null;
  private alternateAnimation: string = 'run';
  
  constructor(benchmarkScene: BenchmarkScene) {
    this.benchmarkScene = benchmarkScene;
    
    // Initialize Stats.js
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.getElementById('stats-container')?.appendChild(this.stats.dom);
    
    // Get UI elements
    this.fpsElement = document.getElementById('fps-value') as HTMLElement;
    this.drawCallsElement = document.getElementById('draw-calls-value') as HTMLElement;
    this.activeInstancesElement = document.getElementById('active-instances-value') as HTMLElement;
    this.drawCallReductionElement = document.getElementById('draw-call-reduction-value') as HTMLElement;
    this.memoryUsageElement = document.getElementById('memory-usage-value') as HTMLElement;
    
    // Control elements
    this.instanceCountSlider = document.getElementById('instance-count') as HTMLInputElement;
    this.instanceCountValueElement = document.getElementById('instance-count-value') as HTMLElement;
    this.instanceModeSelect = document.getElementById('instance-mode') as HTMLSelectElement;
    this.animationTypeSelect = document.getElementById('animation-type') as HTMLSelectElement;
    this.toggleAnimationsButton = document.getElementById('toggle-animations') as HTMLButtonElement;
    this.resetBenchmarkButton = document.getElementById('reset-benchmark') as HTMLButtonElement;
    
    // Initialize UI
    this.initializeUI();
    
    // Start monitoring
    this.startMonitoring();
  }
  
  private initializeUI(): void {
    // Set initial values from benchmark scene config
    const config = this.benchmarkScene.getConfig();
    
    this.instanceCountSlider.value = config.instanceCount.toString();
    this.instanceCountValueElement.textContent = config.instanceCount.toString();
    this.instanceModeSelect.value = config.renderMode;
    this.animationTypeSelect.value = config.animation;
    
    // Check if instancing is available (based on config.renderMode)
    // If we're in standard mode and it's the default, it means instancing is not available
    const isInstancedModeAvailable = !(config.renderMode === RenderMode.STANDARD && 
                                    this.benchmarkScene['instancer'] === null);
    
    if (!isInstancedModeAvailable) {
      // Disable the instanced option
      const instancedOption = Array.from(this.instanceModeSelect.options)
        .find(opt => opt.value === RenderMode.INSTANCED);
      
      if (instancedOption) {
        instancedOption.disabled = true;
        // Add a note about why it's disabled
        instancedOption.text += " (not supported)";
      }
      
      // Show a notification
      this.showNotification("Spine instancing is not available with the current renderer. Using standard mode.");
    }
    
    // Add event listeners
    this.instanceCountSlider.addEventListener('input', this.onInstanceCountChange.bind(this));
    this.instanceModeSelect.addEventListener('change', this.onInstanceModeChange.bind(this));
    this.animationTypeSelect.addEventListener('change', this.onAnimationTypeChange.bind(this));
    this.toggleAnimationsButton.addEventListener('click', this.onToggleAnimations.bind(this));
    this.resetBenchmarkButton.addEventListener('click', this.onResetBenchmark.bind(this));
    
    // Pre-calculate alternate animation
    const currentAnimation = config.animation;
    const animationOptions = Array.from(this.animationTypeSelect.options).map(opt => opt.value);
    const currentIndex = animationOptions.indexOf(currentAnimation);
    const nextIndex = (currentIndex + 1) % animationOptions.length;
    this.alternateAnimation = animationOptions[nextIndex];
  }
  
  /**
   * Display a notification message
   */
  private showNotification(message: string, durationMs: number = 5000): void {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('benchmark-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'benchmark-notification';
      notification.style.position = 'fixed';
      notification.style.top = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'rgba(255, 100, 100, 0.9)';
      notification.style.color = 'white';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '5px';
      notification.style.zIndex = '1000';
      notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
      document.body.appendChild(notification);
    }
    
    // Set message
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Auto-hide after duration
    setTimeout(() => {
      if (notification) {
        notification.style.display = 'none';
      }
    }, durationMs);
  }
  
  private onInstanceCountChange(): void {
    const count = parseInt(this.instanceCountSlider.value);
    this.instanceCountValueElement.textContent = count.toString();
    
    // Update benchmark scene config
    this.benchmarkScene.updateConfig({
      instanceCount: count
    });
  }
  
  private onInstanceModeChange(): void {
    const mode = this.instanceModeSelect.value as RenderMode;
    
    // Update benchmark scene config
    this.benchmarkScene.updateConfig({
      renderMode: mode
    });
  }
  
  private onAnimationTypeChange(): void {
    const animation = this.animationTypeSelect.value;
    
    // Pre-calculate alternate animation
    const animationOptions = Array.from(this.animationTypeSelect.options).map(opt => opt.value);
    const currentIndex = animationOptions.indexOf(animation);
    const nextIndex = (currentIndex + 1) % animationOptions.length;
    this.alternateAnimation = animationOptions[nextIndex];
    
    // Change animation without regenerating the entire scene
    this.benchmarkScene.changeAnimation(animation);
  }
  
  private onToggleAnimations(): void {
    const currentAnimation = this.animationTypeSelect.value;
    
    // Toggle between current and alternate animation
    const newAnimation = currentAnimation === this.alternateAnimation 
      ? this.benchmarkScene.getConfig().animation 
      : this.alternateAnimation;
    
    // Update UI
    this.animationTypeSelect.value = newAnimation;
    
    // Update scene
    this.benchmarkScene.changeAnimation(newAnimation);
  }
  
  private onResetBenchmark(): void {
    // Reset to default config
    const defaultConfig: BenchmarkConfig = {
      instanceCount: 100,
      renderMode: RenderMode.INSTANCED,
      animation: 'idle'
    };
    
    // Update UI elements
    this.instanceCountSlider.value = defaultConfig.instanceCount.toString();
    this.instanceCountValueElement.textContent = defaultConfig.instanceCount.toString();
    this.instanceModeSelect.value = defaultConfig.renderMode;
    this.animationTypeSelect.value = defaultConfig.animation;
    
    // Update benchmark scene
    this.benchmarkScene.updateConfig(defaultConfig);
  }
  
  private startMonitoring(): void {
    // Update stats every 500ms
    this.updateInterval = window.setInterval(() => {
      this.updateStats();
    }, 500);
  }
  
  private updateStats(): void {
    // Get performance data from benchmark scene
    const perfData = this.benchmarkScene.getPerformanceData();
    
    // Update instance count
    this.activeInstancesElement.textContent = perfData.spineCount.toString();
    
    // Update FPS from Stats.js - stats doesn't have getFPS method, need to access the value differently
    // The FPS panel is typically the first panel (index 0) in Stats.js
    let fps = 0;
    if (this.stats.dom) {
      // Try to get FPS from the first panel text content
      const fpsText = this.stats.dom.children[0]?.children[0]?.textContent;
      if (fpsText) {
        fps = parseInt(fpsText) || 0;
      }
    }
    this.fpsElement.textContent = fps.toString();
    
    // Get memory usage
    const memory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryInMB = Math.round(memory / (1024 * 1024));
    this.memoryUsageElement.textContent = `${memoryInMB} MB`;
    
    // Update draw call stats if available
    if (perfData.drawCallStats) {
      const { instanced, standard, saved, reduction } = perfData.drawCallStats;
      this.drawCallsElement.textContent = instanced.toString();
      this.drawCallReductionElement.textContent = `${Math.round(reduction)}% (${saved} saved)`;
      
      // Add color indication based on reduction
      if (reduction > 75) {
        this.drawCallReductionElement.style.color = '#4caf50'; // Green
      } else if (reduction > 50) {
        this.drawCallReductionElement.style.color = '#8bc34a'; // Light green
      } else if (reduction > 25) {
        this.drawCallReductionElement.style.color = '#ffc107'; // Amber
      } else {
        this.drawCallReductionElement.style.color = '#f44336'; // Red
      }
    } else {
      this.drawCallsElement.textContent = 'N/A';
      this.drawCallReductionElement.textContent = 'N/A';
      this.drawCallReductionElement.style.color = '';
    }
  }
  
  public update(): void {
    // Update Stats.js
    this.stats.begin();
    this.stats.end();
  }
  
  public destroy(): void {
    // Clear interval
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
    }
    
    // Remove event listeners
    this.instanceCountSlider.removeEventListener('input', this.onInstanceCountChange.bind(this));
    this.instanceModeSelect.removeEventListener('change', this.onInstanceModeChange.bind(this));
    this.animationTypeSelect.removeEventListener('change', this.onAnimationTypeChange.bind(this));
    this.toggleAnimationsButton.removeEventListener('click', this.onToggleAnimations.bind(this));
    this.resetBenchmarkButton.removeEventListener('click', this.onResetBenchmark.bind(this));
  }
}