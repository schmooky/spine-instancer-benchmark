import { 
  Container, 
  Renderer, 
  InstructionSet, 
  extensions, 
  ExtensionType,
  RenderPipe 
} from 'pixi.js';
import { Spine, SpineFromOptions } from '@esotericsoftware/spine-pixi-v8';
import { RegionAttachment, MeshAttachment, Physics } from '@esotericsoftware/spine-core';
import { SpinePipe } from './SpinePipe';

/**
 * Type definition for a Spine instance with instancing capabilities
 */
export type InstancedSpine = Spine & {
  instanceGroup: string | null;
  isPrimaryInstance: boolean;
  _originalRender: (renderer: Renderer) => void;
};

/**
 * SpineInstanceRenderer - A custom renderer extension for Spine instancing
 * This extends the existing SpinePipe to support instance groups
 */
export class SpineInstancePipe implements RenderPipe<InstancedSpine> {
  /** @ignore */
  static extension = {
    type: [
      ExtensionType.WebGLPipes,
      ExtensionType.WebGPUPipes,
      ExtensionType.CanvasPipes,
    ],
    name: 'spineInstance',
  } as const;

  renderer: Renderer;
  private spinePipe: SpinePipe;
  private instanceGroups: Map<string, InstanceGroup> = new Map();
  private readonly _destroyRenderableBound = this.destroyRenderable.bind(this) as (renderable: Container) => void;
  private _lastFrameDrawCalls: number = 0;
  private _standardDrawCalls: number = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    
    // Check if renderPipes and spine pipe are available
    if (renderer.renderPipes && renderer.renderPipes.spine) {
      this.spinePipe = renderer.renderPipes.spine as SpinePipe;
    } else {
      console.warn('Spine pipe not found in renderer. SpineInstancePipe may not function correctly.');
      // Create a placeholder to avoid null references
      this.spinePipe = {
        validateRenderable: () => false,
        addRenderable: () => {},
        updateRenderable: () => {},
        destroyRenderable: () => {},
        destroy: () => {},
        renderer: renderer
      } as any;
    }
  }

  validateRenderable(spine: InstancedSpine): boolean {
    // If this is a primary instance or has no group, use standard validation
    if (!spine.instanceGroup || spine.isPrimaryInstance) {
      return this.spinePipe.validateRenderable(spine);
    }

    // For secondary instances, always return false to avoid unnecessary rebuilding
    return false;
  }

  addRenderable(spine: InstancedSpine, instructionSet: InstructionSet) {
    // If this has no group or is the primary instance, render normally
    if (!spine.instanceGroup || spine.isPrimaryInstance) {
      this.spinePipe.addRenderable(spine, instructionSet);
      return;
    }

    // For secondary instances, we don't add them to the batch
    // Instead, we just ensure their transforms are updated
    spine._validateAndTransformAttachments();
    spine.spineAttachmentsDirty = false;
    spine.spineTexturesDirty = false;
  }

  getInstanceGroups(){
    return this.instanceGroups;
  }

  updateRenderable(spine: InstancedSpine) {
    // If this has no group or is the primary instance, update normally
    if (!spine.instanceGroup || spine.isPrimaryInstance) {
      this.spinePipe.updateRenderable(spine);
      return;
    }

    // For secondary instances, just update the skeleton and attachments
    spine._validateAndTransformAttachments();
    spine.spineAttachmentsDirty = false;
    spine.spineTexturesDirty = false;
  }

  destroyRenderable(spine: InstancedSpine) {
    this.spinePipe.destroyRenderable(spine);
    spine.off('destroyed', this._destroyRenderableBound);
    
    // Remove from instance group if needed
    if (spine.instanceGroup) {
      const group = this.instanceGroups.get(spine.instanceGroup);
      if (group) {
        group.instances.delete(spine);
        
        // If this was the primary instance, assign a new one
        if (spine.isPrimaryInstance && group.instances.size > 0) {
          const nextPrimary = group.instances.values().next().value;
          nextPrimary.isPrimaryInstance = true;
          group.primaryInstance = nextPrimary;
        }
        
        // If no more instances, remove the group
        if (group.instances.size === 0) {
          this.instanceGroups.delete(spine.instanceGroup);
        }
      }
    }
  }

  destroy() {
    this.instanceGroups.clear();
    this.instanceGroups = null as any;
    this.renderer = null as any;
    this.spinePipe = null as any;
  }

  /**
   * Register a spine instance with an instance group
   */
  registerInstance(spine: InstancedSpine, groupId: string): void {
    // First, unregister from any existing group
    if (spine.instanceGroup && spine.instanceGroup !== groupId) {
      this.unregisterInstance(spine);
    }

    // Register with the new group
    let group = this.instanceGroups.get(groupId);
    
    if (!group) {
      group = {
        id: groupId,
        instances: new Set(),
        primaryInstance: null,
        animation: null,
        time: 0,
      };
      this.instanceGroups.set(groupId, group);
    }
    
    group.instances.add(spine);
    spine.instanceGroup = groupId;
    
    // If this is the first instance in the group, make it the primary
    if (!group.primaryInstance) {
      spine.isPrimaryInstance = true;
      group.primaryInstance = spine;
    } else {
      spine.isPrimaryInstance = false;
    }
    
    // Add the destroyed event listener
    spine.on('destroyed', this._destroyRenderableBound);
  }

  /**
   * Unregister a spine instance from its instance group
   */
  unregisterInstance(spine: InstancedSpine): void {
    if (!spine.instanceGroup) return;
    
    const group = this.instanceGroups.get(spine.instanceGroup);
    if (!group) return;
    
    group.instances.delete(spine);
    
    // If this was the primary instance, assign a new one
    if (spine.isPrimaryInstance && group.instances.size > 0) {
      const nextPrimary = group.instances.values().next().value;
      nextPrimary.isPrimaryInstance = true;
      group.primaryInstance = nextPrimary;
    }
    
    // If no more instances, remove the group
    if (group.instances.size === 0) {
      this.instanceGroups.delete(spine.instanceGroup);
    }
    
    spine.instanceGroup = null;
    spine.isPrimaryInstance = false;
  }

  /**
   * Sync all instances in a group with the primary instance
   */
  syncGroup(groupId: string): void {
    const group = this.instanceGroups.get(groupId);
    if (!group || !group.primaryInstance) return;
    
    const primary = group.primaryInstance;
    
    // Get the current animation track
    const track = primary.state.tracks[0];
    if (!track) return;
    
    // Update group state
    group.animation = track.animation?.name || null;
    group.time = track.trackTime;
    
    // Sync all non-primary instances
    for (const instance of group.instances) {
      if (instance !== primary && group.animation) {
        // Match animation and time with the primary instance
        const instanceTrack = instance.state.setAnimation(0, group.animation, track.loop);
        instanceTrack.trackTime = group.time;
      }
    }
  }

  /**
   * Get information about an instance group
   */
  getGroupInfo(groupId: string): InstanceGroupInfo | null {
    const group = this.instanceGroups.get(groupId);
    if (!group) return null;
    
    return {
      id: group.id,
      instanceCount: group.instances.size,
      primaryInstance: group.primaryInstance,
      currentAnimation: group.animation,
      animationTime: group.time,
    };
  }

  /**
   * Get all instance groups
   */
  getAllGroups(): InstanceGroupInfo[] {
    const groups: InstanceGroupInfo[] = [];
    
    for (const [id, group] of this.instanceGroups.entries()) {
      groups.push({
        id,
        instanceCount: group.instances.size,
        primaryInstance: group.primaryInstance,
        currentAnimation: group.animation,
        animationTime: group.time,
      });
    }
    
    return groups;
  }

  /**
   * Set animation for all instances in a group
   */
  setGroupAnimation(groupId: string, animationName: string, loop: boolean = true): void {
    console.log('SGA',this)
    const group = this.instanceGroups.get(groupId);
    if (!group || !group.primaryInstance) return;
    
    // Set animation on primary instance
    group.primaryInstance.state.setAnimation(0, animationName, loop);
    
    // Sync other instances immediately
    this.syncGroup(groupId);
  }

  /**
   * Get the total number of instances
   */
  getTotalInstances(): number {
    let total = 0;
    for (const group of this.instanceGroups.values()) {
      total += group.instances.size;
    }
    return total;
  }

  /**
   * Get draw call statistics
   */
  getDrawCallStats(): { instanced: number, standard: number, saved: number, reduction: number } {
    // Calculate standard draw calls (estimate)
    // Average 5 draw calls per spine instance
    const avgDrawCallsPerSpine = 5;
    
    // Count primary instances
    let primaryCount = 0;
    for (const group of this.instanceGroups.values()) {
      if (group.primaryInstance) primaryCount++;
    }
    
    // Actual draw calls are from primary instances only
    const instancedDrawCalls = primaryCount * avgDrawCallsPerSpine;
    
    // Calculate what it would be without instancing
    const totalInstances = this.getTotalInstances();
    const standardDrawCalls = totalInstances * avgDrawCallsPerSpine;
    
    // Calculate saved draw calls
    const savedDrawCalls = standardDrawCalls - instancedDrawCalls;
    
    // Calculate percentage reduction
    const reduction = standardDrawCalls > 0 
      ? (savedDrawCalls / standardDrawCalls) * 100 
      : 0;
    
    // Update stored values
    this._lastFrameDrawCalls = instancedDrawCalls;
    this._standardDrawCalls = standardDrawCalls;
    
    return {
      instanced: instancedDrawCalls,
      standard: standardDrawCalls,
      saved: savedDrawCalls,
      reduction: reduction
    };
  }
}

/**
 * Interface for instance group information
 */
export interface InstanceGroupInfo {
  id: string;
  instanceCount: number;
  primaryInstance: InstancedSpine | null;
  currentAnimation: string | null;
  animationTime: number;
}

/**
 * Internal interface for instance groups
 */
interface InstanceGroup {
  id: string;
  instances: Set<InstancedSpine>;
  primaryInstance: InstancedSpine | null;
  animation: string | null;
  time: number;
}

/**
 * SpineInstancer - Utility class for working with instanced spines
 */
export class SpineInstancer {
  private renderer: Renderer;
  private instancePipe: SpineInstancePipe | null = null;
  
  constructor(renderer: Renderer) {
    this.renderer = renderer;
    
    // Check if renderPipes is available (PIXI v8 with WebGL/WebGPU)
    if (!renderer.renderPipes) {
      console.warn('renderer.renderPipes not found. This may be because you are using a renderer that does not support render pipes. Falling back to standard rendering.');
      return;
    }
    
    // Check if spineInstance pipe is registered
    this.instancePipe = renderer.renderPipes.spineInstance as SpineInstancePipe;
    console.log(extensions._queue[ExtensionType.WebGLPipes])
    console.log(renderer)
    if (!this.instancePipe) {
      console.warn('SpineInstancePipe not found. Make sure it has been registered with the renderer.');
    }
  }
  
  /**
   * Create a new instanced spine using Spine.from
   */
  createInstancedSpine(options: SpineFromOptions): InstancedSpine {
    console.log(`Creating Instanced Spine with options:`, options);
    
    // Create a spine instance using Spine.from
    const spine = Spine.from(options) as InstancedSpine;
    
    // Add instancing properties
    spine.instanceGroup = null;
    spine.isPrimaryInstance = false;
    
    // Store the original render method
    spine._originalRender = spine._render;
    
    // Override the render method to handle instancing
    spine._render = function(renderer: Renderer): void {
      // Get the instance pipe
      const instancePipe = renderer.renderPipes?.spineInstance as SpineInstancePipe;
      
      if (!instancePipe || !this.instanceGroup || this.isPrimaryInstance) {
        // Fall back to standard rendering if no instancing is available
        // or if this is a primary instance
        this._originalRender(renderer);
        return;
      }
      
      // Update the transforms but skip rendering
      this._validateAndTransformAttachments();
    };
    
    // Important: Make sure the skeleton is set up properly
    spine.autoUpdate = true;
    
    return spine;
  }
  
  // Modified syncGroup method for SpineInstancePipe class
  syncGroup(groupId: string): void {
    const group = this.instancePipe!.getInstanceGroups().get(groupId);
    if (!group || !group.primaryInstance) return;
    
    const primary = group.primaryInstance;
    
    // Ensure the primary instance's animation state is updated
    primary.state.update(0.016); // Update with a small delta time
    
    // Get the current animation track
    const track = primary.state.tracks[0];
    if (!track) return;
    
    // Update group state
    group.animation = track.animation?.name || null;
    group.time = track.trackTime;
    
    // Sync all non-primary instances
    for (const instance of group.instances) {
      if (instance !== primary) {
        if (group.animation) {
          // Match animation and time with the primary instance
          if (instance.state.tracks[0] && 
              instance.state.tracks[0].animation?.name === group.animation) {
            // Just update the time if it's the same animation
            instance.state.tracks[0].trackTime = group.time;
          } else {
            // Set a new animation if it's different
            const instanceTrack = instance.state.setAnimation(0, group.animation, track.loop);
            instanceTrack.trackTime = group.time;
          }
        }
        
        // Make sure to apply the animation
        instance.state.apply(instance.skeleton);
        instance.skeleton.updateWorldTransform(Physics.update);
      }
    }
  }
  
  // Modified update method for SpineInstancer class
  update(deltaTime: number = 0.016): void {
    if (!this.instancePipe) return;
    
    const groups = this.instancePipe.getAllGroups();

    for (const group of groups) {
      if (group.primaryInstance) {
        // Ensure the animation state of the primary instance is updated with time
        group.primaryInstance.state.update(deltaTime);
        group.primaryInstance.state.apply(group.primaryInstance.skeleton);
        group.primaryInstance.skeleton.updateWorldTransform(Physics.update);
      }
      
      this.instancePipe.syncGroup(group.id);
    }
  }
  
  // Modified setGroupAnimation method for SpineInstancePipe class
  setGroupAnimation(groupId: string, animationName: string, loop: boolean = true): void {
    const group = this.instancePipe!.getInstanceGroups().get(groupId);
    if (!group || !group.primaryInstance) return;
    
    console.log(`Setting group animation: ${groupId} -> ${animationName} (loop: ${loop})`);
    
    // Clear any existing animations
    // group.primaryInstance.state.clearTracks();
    
    // Set animation on primary instance
    const track = group.primaryInstance.state.setAnimation(0, animationName, loop);
    
    // Force an initial update
    group.primaryInstance.state.update(0);
    group.primaryInstance.state.apply(group.primaryInstance.skeleton);
    group.primaryInstance.skeleton.updateWorldTransform(Physics.update);
    
    // Update group state
    group.animation = animationName;
    group.time = 0;
    
    // Sync other instances immediately
    for (const instance of group.instances) {
      if (instance !== group.primaryInstance) {
        // Clear any existing animations on this instance too
        instance.state.clearTracks();
        
        // Set the same animation
        const instanceTrack = instance.state.setAnimation(0, animationName, loop);
        
        // Force an initial update
        instance.state.update(0);
        instance.state.apply(instance.skeleton);
        instance.skeleton.updateWorldTransform(Physics.update);
      }
    }
  }
  
  /**
   * Register a spine with an instance group
   */
  addToGroup(spine: InstancedSpine, groupId: string): void {
    if (!this.instancePipe) return;
    this.instancePipe.registerInstance(spine, groupId);
  }
  
  /**
   * Remove a spine from its instance group
   */
  removeFromGroup(spine: InstancedSpine): void {
    if (!this.instancePipe) return;
    this.instancePipe.unregisterInstance(spine);
  }
  
  /**
   * Create a container with multiple instanced spines
   */
  createInstancedGroup(
    options: SpineFromOptions,
    count: number, 
    groupId: string, 
    animation?: string, 
    loop: boolean = true
  ): Container {
    const container = new Container();
    
    if (!this.instancePipe) {
      console.warn('SpineInstancePipe not available. Creating standard Spine instances.');
      // Create standard instances if instancing is not available
      for (let i = 0; i < count; i++) {
        const spine = Spine.from(options);
        if (animation) {
          spine.state.setAnimation(0, animation, loop);
        }
        container.addChild(spine);
      }
      return container;
    }
    
    for (let i = 0; i < count; i++) {
      const instance = this.createInstancedSpine(options);
      this.addToGroup(instance, groupId);
      
      if (animation) {
        // Only set animation on the primary instance
        if (instance.isPrimaryInstance) {
          instance.state.setAnimation(0, animation, loop);
        }
      }
      
      container.addChild(instance);
    }
    
    // Sync all instances in the group
    if (animation) {
      this.instancePipe.syncGroup(groupId);
    }
    
    return container;
  }
  
  /**
   * Get debug information about all instance groups
   */
  getDebugInfo(): string {
    if (!this.instancePipe) return "SpineInstancer Debug: Not available (renderer does not support render pipes)";
    
    const groups = this.instancePipe.getAllGroups();
    
    let info = "SpineInstancer Debug:\n";
    info += `Total groups: ${groups.length}\n\n`;
    
    for (const group of groups) {
      info += `Group "${group.id}": ${group.instanceCount} instances\n`;
      info += `  Animation: ${group.currentAnimation || 'none'}\n`;
      info += `  Time: ${group.animationTime.toFixed(2)}\n`;
    }
    
    return info;
  }

  /**
   * Get information about a specific group
   */
  getGroupInfo(groupId: string): InstanceGroupInfo | null {
    if (!this.instancePipe) return null;
    return this.instancePipe.getGroupInfo(groupId);
  }

  /**
   * Get the total number of instances
   */
  getTotalInstances(): number {
    if (!this.instancePipe) return 0;
    return this.instancePipe.getTotalInstances();
  }

  /**
   * Get draw call statistics
   */
  getDrawCallStats(): { instanced: number, standard: number, saved: number, reduction: number } {
    if (!this.instancePipe) {
      return {
        instanced: 0,
        standard: 0,
        saved: 0,
        reduction: 0
      };
    }
    return this.instancePipe.getDrawCallStats();
  }
}

/**
 * Initialize the SpineInstancer system
 * Call this before using any instancing features
 */
export function initSpineInstancing(renderer: Renderer): SpineInstancer | null {
  if (!renderer.renderPipes) {
    console.warn('Renderer does not support render pipes. Spine instancing is not available.');
    return new SpineInstancer(renderer); // Return a limited instancer
  }

  try {
    // Create the pipe manually
    const pipe = new SpineInstancePipe(renderer);
    
    // Add it to the renderer's pipe collection
    renderer.renderPipes.spineInstance = pipe;
    
    // Create the instancer
    return new SpineInstancer(renderer);
  } catch (error) {
    console.error('Failed to initialize SpineInstancer:', error);
    return null;
  }
}