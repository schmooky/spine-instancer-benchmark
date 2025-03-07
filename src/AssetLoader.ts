import { Assets } from "pixi.js";

export interface AssetLoadProgress {
  progress: number;
  loaded: number;
  total: number;
}

export interface SpineAssetInfo {
  skeleton: any;
  atlas: any;
  textures: any[];
}

/**
 * Asset loading utility class
 */
export class AssetLoader {
  private static readonly SPINE_ASSETS = {
    god: {
      skeleton: "/spine/god.json",
      atlas: "/spine/god.atlas",
    },
    // Add more spine characters as needed
  };

  private static initialized = false;

  /**
   * Initialize the asset loader
   */
  public static async init(): Promise<void> {
    if (this.initialized) return;

    // Add bundles for each spine character
    for (const [character, assets] of Object.entries(this.SPINE_ASSETS)) {
      Assets.add({ alias: character, src: assets.skeleton });
      Assets.add({ alias: `${character}-atlas`, src: assets.atlas });
    }


    this.initialized = true;
  }

  /**
   * Load a spine character
   * @param character The character name
   * @param progressCallback Optional callback for load progress
   */
  public static async loadSpineCharacter(
    character: keyof typeof AssetLoader.SPINE_ASSETS,
    progressCallback?: (progress: AssetLoadProgress) => void
  ): Promise<any> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      console.log('Loading Skeleton')
      // Load the character assets
      const skeleton = await Assets.load([character,`${character}-atlas`], (progress) => {
        if (progressCallback) {
          progressCallback({
            progress: progress,
            loaded: progress * 100,
            total: 100,
          });
        }
      });

      console.log('Skeleton Loaded')
      console.log(Assets.cache)

      // Return the skeleton data
      return skeleton;
    } catch (error) {
      console.error(`Failed to load spine character '${character}':`, error);
      throw error;
    }
  }

  /**
   * Load all spine characters
   * @param progressCallback Optional callback for load progress
   */
  public static async loadAllSpineCharacters(
    progressCallback?: (progress: AssetLoadProgress) => void
  ): Promise<Record<string, any>> {
    if (!this.initialized) {
      await this.init();
    }

    const characters = Object.keys(this.SPINE_ASSETS);
    const total = characters.length;
    const results: Record<string, any> = {};

    for (let i = 0; i < characters.length; i++) {
      const character = characters[i] as keyof typeof AssetLoader.SPINE_ASSETS;

      try {
        results[character] = await this.loadSpineCharacter(
          character,
          (characterProgress) => {
            if (progressCallback) {
              progressCallback({
                progress: (i + characterProgress.progress) / total,
                loaded: i + 1,
                total: total,
              });
            }
          }
        );
      } catch (error) {
        console.error(`Failed to load spine character '${character}':`, error);
        // Continue loading other characters
      }
    }

    return results;
  }
}
