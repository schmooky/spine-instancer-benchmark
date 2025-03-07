import { Container, Graphics, Application, Assets } from 'pixi.js';
import { Physics, Spine, SpineFromOptions } from '@esotericsoftware/spine-pixi-v8';
import { InstancedSpine, SpineInstancer } from './SpineInstancer';

export enum RenderMode {
  STANDARD = 'standard',
  INSTANCED = 'instanced'
}

export interface BenchmarkConfig {
  instanceCount: number;
  renderMode: RenderMode;
  animation: string;
}

export class BenchmarkScene {
  private app: Application;
  private mainContainer: Container;
  private spineData: any;
  private spines: (Spine | InstancedSpine)[] = [];
  private instancer: SpineInstancer | null = null;
  private config: BenchmarkConfig;
  private background: Graphics;
  
  constructor(app: Application, instancer: SpineInstancer | null = null) {
    this.app = app;
    this.instancer = instancer;
    this.mainContainer = new Container();
    this.app.stage.addChild(this.mainContainer);
    
    // Create default config
    this.config = {
      instanceCount: 40,
      renderMode: RenderMode.INSTANCED,
      animation: 'idle'
    };
    
    // Create background
    this.background = new Graphics();
    this.mainContainer.addChild(this.background);
    this.drawBackground();
    
    // Resize handler
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }
  
  public setSpineData(spineData: any): void {
    this.spineData = spineData;
  }
  
  public getConfig(): BenchmarkConfig {
    return { ...this.config };
  }
  
  public updateConfig(config: Partial<BenchmarkConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Regenerate the scene if any configuration changed
    this.generateScene();
  }
  
  public generateScene(): void {
    // Clear existing spines
    this.clearSpines();
    
    if (!this.spineData) {
      console.error('No spine data available. Set spine data before generating the scene.');
      return;
    }
    
    if (this.config.renderMode === RenderMode.INSTANCED && !this.instancer) {
      console.warn('Instanced mode requires a SpineInstancer. SpineInstancer is not available or failed to initialize. Falling back to standard mode.');
      // Automatically switch to standard mode if instancer is not available
      this.config.renderMode = RenderMode.STANDARD;
    }
    
    // Create spines based on current configuration
    if (this.config.renderMode === RenderMode.INSTANCED && this.instancer) {
      this.generateInstancedSpines();
    } else {
      this.generateStandardSpines();
    }
  }
  
  private generateStandardSpines(): void {
    const count = this.config.instanceCount;
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;
    
    // Calculate grid dimensions
    const cols = Math.ceil(Math.sqrt(count * (screenWidth / screenHeight)));
    const rows = Math.ceil(count / cols);
    
    // Calculate spacing
    const spacingX = 0.1*screenWidth / (cols + 1);
    const spacingY = 0.1*screenHeight / (rows + 1);
    
    // Create spines
    for (let i = 0; i < count; i++) {
      // Use Spine.from instead of new Spine() to match new approach
      const spine = Spine.from({ skeleton: 'god', atlas: 'god-atlas' });
      
      // Set animation
      spine.state.setAnimation(0, this.config.animation, true);
      
      // Position spine
      const col = i % cols;
      const row = Math.floor(i / cols);
      spine.position.set(
        screenWidth*0.2 + spacingX * (col + 1),
        screenHeight*0.2 + spacingY * (row + 1)
      );
      
      // Scale spine
      spine.scale.set(0.25);
      
      // Add to container
      this.mainContainer.addChild(spine);
      this.spines.push(spine);
    }
  }
  
  private generateInstancedSpines(): void {
    const count = this.config.instanceCount;
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;
    
    // Calculate grid dimensions
    const cols = Math.ceil(Math.sqrt(count * (screenWidth / screenHeight)));
    const rows = Math.ceil(count / cols);
    
    // Calculate spacing
    const spacingX = 0.1*screenWidth / (cols + 1);
    const spacingY = 0.1*screenHeight / (rows + 1);
    
    // Create container for instanced spines
    const groupId = `benchmark-group`;
    
    // Create SpineFromOptions object to use with Spine.from
    const spineOptions: SpineFromOptions = { skeleton: 'god', atlas:'god-atlas' };
    
    const container = this.instancer!.createInstancedGroup(
      spineOptions,  // Pass options object instead of spineData directly
      count,
      groupId,
      this.config.animation,
      true
    );
    
    // Position each spine
    let i = 0;
    for (const child of container.children) {
      const spine = child as InstancedSpine;
      
      // Position spine
      const col = i % cols;
      const row = Math.floor(i / cols);
      spine.position.set(
        screenWidth*0.2 + spacingX * (col + 1),
        screenHeight*0.2 + spacingY * (row + 1)
      );
      
      // Scale spine
      spine.scale.set(0.25);
      
      // Add to tracking array
      this.spines.push(spine);
      i++;
    }
    
    // Add container to main container
    this.mainContainer.addChild(container);
  }
  
  private clearSpines(): void {
    // Remove all spines
    for (const spine of this.spines) {
      if (spine.parent) {
        spine.parent.removeChild(spine);
      }
      spine.destroy();
    }
    
    // Clear array
    this.spines = [];
  }
  
  public onResize(): void {
    this.drawBackground();
    
    // If we have spines, regenerate the scene to reposition them
    if (this.spines.length > 0) {
      this.generateScene();
    }
  }
  
  private drawBackground(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    
    this.background.clear();
    
    // Draw gradient background
    this.background.beginFill(0x1a1a1a);
    this.background.drawRect(0, 0, width, height);
    this.background.endFill();
    
    // Draw grid
    this.background.lineStyle(1, 0x333333, 0.5);
    
    // Vertical lines
    const vSpacing = width / 20;
    for (let x = vSpacing; x < width; x += vSpacing) {
      this.background.moveTo(x, 0);
      this.background.lineTo(x, height);
    }
    
    // Horizontal lines
    const hSpacing = height / 20;
    for (let y = hSpacing; y < height; y += hSpacing) {
      this.background.moveTo(0, y);
      this.background.lineTo(width, y);
    }
  }
  
  public update(deltaTime: number = 0.016): void {
    // Update instancer if using instanced mode
    if (this.config.renderMode === RenderMode.INSTANCED && this.instancer) {
      this.instancer.update(deltaTime);
    } else {
      // For standard spines, we need to manually update their animation state
      for (const spine of this.spines) {
        spine.state.update(deltaTime);
        spine.state.apply(spine.skeleton);
        spine.skeleton.updateWorldTransform(Physics.update);
      }
    }
  }
  
  public destroy(): void {
    // Clean up
    window.removeEventListener('resize', this.onResize);
    this.clearSpines();
    this.mainContainer.destroy();
  }
  
  public getPerformanceData(): {
    spineCount: number;
    renderMode: RenderMode;
    drawCallStats?: { instanced: number; standard: number; saved: number; reduction: number; }
  } {
    const data = {
      spineCount: this.spines.length,
      renderMode: this.config.renderMode,
    };
    
    if (this.config.renderMode === RenderMode.INSTANCED && this.instancer) {
      return {
        ...data,
        drawCallStats: this.instancer.getDrawCallStats()
      };
    }
    
    return data;
  }

  // Add this method to the BenchmarkScene class
private getAvailableAnimations(): string[] {
  // Try to create a test spine to get available animations
  try {
    const testSpine = Spine.from({ skeleton: 'god', atlas: 'god-atlas' });
    
    // Get all animations
    const animations: string[] = [];
    
    if (testSpine.skeleton.data && testSpine.skeleton.data.animations) {
      for (let i = 0; i < testSpine.skeleton.data.animations.length; i++) {
        const anim = testSpine.skeleton.data.animations[i];
        if (anim && anim.name) {
          animations.push(anim.name);
        }
      }
    }
    
    // Clean up
    testSpine.destroy();
    
    return animations.length > 0 ? animations : ['idle', 'walk', 'run', 'jump'];
  } catch (e) {
    console.error('Failed to get animations:', e);
    return ['idle', 'walk', 'run', 'jump'];
  }
}

// Replace the changeAnimation method in BenchmarkScene
public changeAnimation(animationName: string): void {
  const availableAnims = this.getAvailableAnimations();
  
  // Check if the animation exists
  if (!availableAnims.includes(animationName)) {
    console.warn(`Animation "${animationName}" not found. Available animations: ${availableAnims.join(', ')}`);
    
    // Use the first available animation instead
    if (availableAnims.length > 0) {
      animationName = availableAnims[0];
      console.log(`Using "${animationName}" instead.`);
    } else {
      console.error('No animations available!');
      return;
    }
  }
  
  this.config.animation = animationName;
  
  if (this.spines.length === 0) return;
  
  console.log(`Changing animation to: ${animationName}`);
  
  if (this.config.renderMode === RenderMode.INSTANCED && this.instancer) {
    // For instanced spines, change the group animation
    const groupId = `benchmark-group`;
    this.instancer.setGroupAnimation(groupId, animationName, true);
    
  } else {
    // For standard spines, change each animation individually
    for (const spine of this.spines) {
      spine.state.setAnimation(0, animationName, true);
    }
  }
}
}