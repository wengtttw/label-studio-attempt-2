import TriggerOptions = Cypress.TriggerOptions;
import ObjectLike = Cypress.ObjectLike;
import ClickOptions = Cypress.ClickOptions;
import { withMedia } from "@humansignal/frontend-test/helpers/utils/media/MediaMixin";
import { LabelStudio } from "@humansignal/frontend-test/helpers/LSF/LabelStudio";
import type { ViewWithMedia } from "@humansignal/frontend-test/helpers/utils/media/types";

type MouseInteractionOptions = Partial<TriggerOptions & ObjectLike & MouseEvent>;

class AudioViewHelper extends withMedia(
  class implements ViewWithMedia {
    get _baseRootSelector() {
      return ".lsf-audio-tag";
    }

    _rootSelector: string;

    constructor(rootSelector: string) {
      this._rootSelector = rootSelector.replace(/^\&/, this._baseRootSelector);
    }

    get root() {
      return cy.get(this._rootSelector);
    }

    get errorContainer() {
      return this.root.find('[data-testid^="error:"]', { timeout: 30000 });
    }

    get drawingArea() {
      return this.root.find("canvas");
    }

    get visualizer() {
      return this.drawingArea.parent();
    }

    get container() {
      return this.visualizer.parent();
    }

    get timelineControls() {
      return this.root.find(".lsf-timeline-controls");
    }

    get currentTimebox() {
      return this.timelineControls.find('[data-testid="timebox-current-time"] > .lsf-time-box__input-time');
    }

    get endTimebox() {
      return this.timelineControls.find('[data-testid="timebox-end-time"] > .lsf-time-box__input-time');
    }

    get configButton() {
      return this.timelineControls.find(".lsf-audio-config > [aria-label='Audio settings']");
    }
    get volumeButton() {
      return this.timelineControls.find(".lsf-audio-control > .lsf-button");
    }

    get loadingBar() {
      return this.root.get("loading-progress-bar", { timeout: 10000 });
    }

    get audioElement() {
      return this.root.get('[data-testid="waveform-audio"]');
    }

    get mediaElement() {
      return this.audioElement.should("exist");
    }

    get volumeSlider() {
      return this.root.find(".lsf-audio-slider__range");
    }

    get volumeInput() {
      return this.root.find(".lsf-audio-slider__input");
    }

    get muteButton() {
      return this.root.find(".lsf-audio-control__mute-button");
    }

    get playbackSpeedSlider() {
      return cy.get(
        ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(2) .lsf-audio-slider__range",
      );
    }

    get playbackSpeedInput() {
      return cy.get(
        ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(2) .lsf-audio-slider__input",
      );
    }

    get amplitudeSlider() {
      return cy.get(
        ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(3) .lsf-audio-slider__range",
      );
    }

    get amplitudeInput() {
      return cy.get(
        ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(3) .lsf-audio-slider__input",
      );
    }

    get hideTimelineButton() {
      return this.root.get(".lsf-audio-config__buttons > .lsf-audio-config__menu-button:nth-child(1)");
    }

    get hideWaveformButton() {
      return this.root.get(".lsf-audio-config__buttons > .lsf-audio-config__menu-button:nth-child(2)");
    }

    isReady() {
      LabelStudio.waitForObjectsReady();
      this.loadingBar.should("not.exist");
      /**
       * Enhanced audio ready state checking with canvas stabilization
       * Replaces the previous fixed 32ms wait with actual canvas rendering verification
       * This ensures the canvas is fully rendered before proceeding with tests
       */
      this.waitForCanvasStable();
    }

    _playButtonSelector = '[data-testid="playback-button:play"]';
    get playButton() {
      return this.root.find(this._playButtonSelector);
    }

    _pauseButtonSelector = '[data-testid="playback-button:pause"]';
    get pauseButton() {
      return this.root.find(this._pauseButtonSelector);
    }

    seekCurrentTimebox(to: number) {
      let timeString = "";
      timeString = `${to.toString().padStart(6, "0")}000`;

      this.currentTimebox.click({ force: true }).clear().type(timeString, { force: true }).blur();
    }

    pause() {
      this.pauseButton.click();
    }

    play(from?: number, to?: number) {
      if (from) {
        this.seekCurrentTimebox(from);
      }
      this.playButton.click();
      if (to) {
        cy.wait((to - (from || 0)) * 1000);
        this.pause();
      }
    }

    toggleControlsMenu() {
      this.volumeButton.click();
      cy.wait(100);
    }

    toggleSettingsMenu() {
      this.configButton.click();
      cy.wait(100);
    }

    setVolumeInput(value: number) {
      this.toggleControlsMenu();
      this.volumeInput.clear().type(value.toString());
      this.volumeInput.should("have.value", value.toString());
      this.toggleControlsMenu();
    }

    setPlaybackSpeedInput(value: number, checkVideo = true) {
      cy.log(`🎵 Setting playback speed to ${value}x`);
      this.toggleSettingsMenu();
      this.playbackSpeedInput.dblclick().clear().type(value.toString());
      this.playbackSpeedInput.should("have.value", value.toString());
      this.toggleSettingsMenu();

      // Wait for the speed change to propagate to audio/video elements
      this.waitForPlaybackRate(value, 8000, checkVideo);
      cy.log(`✅ Playback speed set to ${value}x`);
    }

    setAmplitudeInput(value: number) {
      this.toggleSettingsMenu();
      this.amplitudeInput.clear().type(value.toString());
      this.amplitudeInput.should("have.value", value.toString());
      this.toggleSettingsMenu();
    }

    clickMuteButton() {
      this.toggleControlsMenu();
      this.muteButton.click();
      this.toggleControlsMenu();
    }

    /**
     * Clicks at the coordinates on the drawing area
     * @param {number} x
     * @param {number} y
     */
    clickAt(x: number, y: number, options?: Partial<ClickOptions>) {
      cy.log(`Click at the AudioView at (${x}, ${y})`);
      this.drawingArea.scrollIntoView().click(x, y, options);
    }

    /**
     * Clicks at the relative coordinates on the drawing area
     * @param {number} x
     * @param {number} y
     */
    clickAtRelative(x: number, y = 0.5, options?: Partial<ClickOptions>) {
      this.drawingArea.then((el) => {
        const bbox: DOMRect = el[0].getBoundingClientRect();
        const realX = x * bbox.width;
        const realY = y * bbox.height;

        this.clickAt(realX, realY, options);
      });
    }

    hoverAt(x: number, y: number, options: MouseInteractionOptions = {}) {
      cy.log(`Hover at the AudioView at (${x}, ${y})`);
      this.drawingArea.scrollIntoView().trigger("mousemove", x, y, options);
    }

    hoverAtRelative(x: number, y: number, options: MouseInteractionOptions = {}) {
      this.drawingArea.then((el) => {
        const bbox: DOMRect = el[0].getBoundingClientRect();
        const realX = x * bbox.width;
        const realY = y * bbox.height;

        this.hoverAt(realX, realY, options);
      });
    }

    /**
     * Draws a rectangle on the drawing area.
     * It also could be used for some drag and drop interactions for example selecting area or moving existing regions.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    drawRect(x: number, y: number, width: number, height: number, options: MouseInteractionOptions = {}) {
      cy.log(`Draw rectangle at (${x}, ${y}) of size ${width}x${height}`);
      this.drawingArea
        .scrollIntoView()
        .trigger("mousemove", x, y, {
          eventConstructor: "MouseEvent",
          buttons: 1,
          ...options,
        })
        .trigger("mousedown", x, y, {
          eventConstructor: "MouseEvent",
          buttons: 1,
          ...options,
        })
        .trigger("mousemove", x + width, y + height, {
          eventConstructor: "MouseEvent",
          buttons: 1,
          ...options,
        })
        .trigger("mouseup", x + width, y + height, {
          eventConstructor: "MouseEvent",
          buttons: 1,
          ...options,
        })
        .wait(0);
    }

    /**
     * Draws the rectangle on the drawing area with coordinates and size relative to the drawing area.
     * It also could be used for some drag and drop interactions for example selecting area or moving existing regions.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    drawRectRelative(x: number, y: number, width: number, height: number, options: MouseInteractionOptions = {}) {
      this.drawingArea.then((el) => {
        const bbox: DOMRect = el[0].getBoundingClientRect();
        const realX = x * bbox.width;
        const realY = y * bbox.height;
        const realWidth = width * bbox.width;
        const realHeight = height * bbox.height;

        this.drawRect(realX, realY, realWidth, realHeight, options);
      });
    }

    /**
     * Matches the visual appearance of the entire AudioView component
     */
    toMatchImageSnapshot(el?: Cypress.Chainable<JQuery<HTMLElement>>, options?: { name?: string; threshold?: number }) {
      el = el || this.root;
      let name;
      if (options && options.name) {
        name = options.name;
        delete options.name;
      }
      if (name) {
        el.wait(0).matchImageSnapshot(name);
      } else {
        el.wait(0).matchImageSnapshot();
      }
    }

    getPixelColor(x: number, y: number) {
      this.drawingArea.trigger("getPixelColor", x, y);
      return this.drawingArea.then(async (canvas) => {
        const ctx = canvas[0].getContext("2d");
        const pixelRatio = window.devicePixelRatio;

        // Ensure coordinates are within canvas bounds
        const canvasEl = canvas[0] as HTMLCanvasElement;
        const adjustedX = Math.max(0, Math.min(Math.round(x) * pixelRatio, canvasEl.width - 1));
        const adjustedY = Math.max(0, Math.min(Math.round(y) * pixelRatio, canvasEl.height - 1));

        const pixel = ctx.getImageData(adjustedX, adjustedY, 1, 1);

        const displayColor = `rgba(${pixel.data[0]}, ${pixel.data[1]}, ${pixel.data[2]}, ${pixel.data[3]})`;
        cy.log(
          `🎨 Pixel at (${x}, ${y}) -> canvas(${adjustedX}, ${adjustedY}): ${displayColor} | Canvas: ${canvasEl.width}x${canvasEl.height} | Ratio: ${pixelRatio}`,
        );

        // Log warning if we get transparent pixels
        if (pixel.data[0] === 0 && pixel.data[1] === 0 && pixel.data[2] === 0 && pixel.data[3] === 0) {
          cy.log(`⚠️ WARNING: Transparent pixel detected at (${x}, ${y}) - canvas may not be ready`);
        }

        return await pixel.data;
      });
    }

    getPixelColorRelative(x: number, y: number) {
      return this.drawingArea.then((el) => {
        const bbox: DOMRect = el[0].getBoundingClientRect();
        const realX = x * bbox.width;
        const realY = y * bbox.height;

        return this.getPixelColor(realX, realY);
      });
    }

    /**
     * Gets pixel color with retry logic for more stable color sampling
     * @param x relative x coordinate (0-1)
     * @param y relative y coordinate (0-1)
     * @param retries number of retries if colors are inconsistent
     */
    getStablePixelColorRelative(x: number, y: number, retries = 3) {
      let attempts = 0;
      let lastColor: Uint8ClampedArray | null = null;

      const sampleColor = () => {
        return this.getPixelColorRelative(x, y).then((color) => {
          attempts++;

          // If we have a previous color, check if they match
          if (lastColor && this.colorsEqual(lastColor, color)) {
            return color;
          }

          lastColor = color;

          // If we haven't reached max retries, wait and try again
          if (attempts < retries) {
            cy.wait(16); // Wait one frame
            return sampleColor();
          }

          // Return the last sampled color
          return color;
        });
      };

      return sampleColor();
    }

    /**
     * Compares two color arrays for equality
     * @param color1 first color array
     * @param color2 second color array
     */
    colorsEqual(color1: Uint8ClampedArray, color2: Uint8ClampedArray): boolean {
      if (color1.length !== color2.length) return false;
      for (let i = 0; i < color1.length; i++) {
        if (color1[i] !== color2[i]) return false;
      }
      return true;
    }

    /**
     * Wait a couple of animation frames based on the requestAnimationFrame pattern
     */
    waitForStableState() {
      // This ensures React has completed its render cycle
      cy.waitForFrames(2);
    }

    /**
     * Waits for canvas rendering to stabilize by checking that pixel colors remain consistent
     * @param x relative x coordinate to monitor
     * @param y relative y coordinate to monitor
     * @param stabilityChecks number of consecutive stable checks required
     * @param timeout maximum time to wait in milliseconds
     */
    waitForCanvasStable(x = 0.36, y = 0.9, stabilityChecks = 3, timeout = 10000) {
      let stableCount = 0;
      let lastColor: Uint8ClampedArray | null = null;
      const startTime = Date.now();

      const checkStability = (): Cypress.Chainable => {
        if (Date.now() - startTime > timeout) {
          cy.log(`⏰ Canvas stabilization timeout after ${timeout}ms`);
          return cy.wrap(null);
        }

        return this.getPixelColorRelative(x, y).then((currentColor) => {
          // Check if we're getting transparent pixels (indicates canvas not ready)
          const isTransparent =
            currentColor[0] === 0 && currentColor[1] === 0 && currentColor[2] === 0 && currentColor[3] === 0;

          if (isTransparent) {
            cy.log("🔍 Canvas not ready - transparent pixel detected, continuing to wait...");
            stableCount = 0;
            lastColor = null;
            cy.wait(100); // Wait longer for CI environments
            return checkStability();
          }

          if (lastColor && this.colorsEqual(lastColor, currentColor)) {
            stableCount++;
            cy.log(`✅ Canvas stable check ${stableCount}/${stabilityChecks}`);
            if (stableCount >= stabilityChecks) {
              cy.log(`🎯 Canvas stabilized after ${stableCount} consecutive checks`);
              return cy.wrap(null);
            }
          } else {
            stableCount = 0;
            cy.log("🔄 Canvas changed, resetting stability counter");
          }

          lastColor = currentColor;
          cy.wait(16); // Wait one frame
          return checkStability();
        });
      };

      cy.log(`🏁 Starting canvas stabilization check at (${x}, ${y})`);
      return checkStability();
    }

    /**
     * Waits for canvas to have actual content (non-transparent pixels)
     * @param timeout maximum time to wait in milliseconds
     */
    waitForCanvasContent(timeout = 15000) {
      const startTime = Date.now();

      const checkForContent = (): Cypress.Chainable => {
        if (Date.now() - startTime > timeout) {
          cy.log(`⏰ Canvas content timeout after ${timeout}ms`);
          return cy.wrap(null);
        }

        return this.drawingArea.then((canvas) => {
          const ctx = (canvas[0] as HTMLCanvasElement).getContext("2d");
          const canvasEl = canvas[0] as HTMLCanvasElement;

          // Sample multiple points to check for content
          const samplePoints = [
            { x: canvasEl.width * 0.25, y: canvasEl.height * 0.5 },
            { x: canvasEl.width * 0.5, y: canvasEl.height * 0.5 },
            { x: canvasEl.width * 0.75, y: canvasEl.height * 0.5 },
          ];

          let hasContent = false;
          for (const point of samplePoints) {
            const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
            // Check if pixel has any non-transparent content
            if (pixel.data[3] > 0 || pixel.data[0] > 0 || pixel.data[1] > 0 || pixel.data[2] > 0) {
              hasContent = true;
              break;
            }
          }

          if (hasContent) {
            cy.log("🎨 Canvas has content!");
            return cy.wrap(null);
          }
          cy.log("🔍 Canvas empty, waiting for content...");
          cy.wait(200); // Increased wait for CI environments
          return checkForContent();
        });
      };

      cy.log("🏁 Waiting for canvas content...");
      return checkForContent();
    }

    /**
     * Waits for audio and video elements to be synchronized
     * @param tolerance tolerance for time/rate differences
     * @param timeout maximum time to wait
     * @param checkVideo whether to check video sync (default: true)
     */
    waitForMediaSync(tolerance = 0.01, timeout = 5000, checkVideo = true) {
      const startTime = Date.now();

      const checkSync = (): Cypress.Chainable => {
        if (Date.now() - startTime > timeout) {
          cy.log(`⏰ Media sync timeout after ${timeout}ms`);
          return cy.wrap(null);
        }

        if (checkVideo) {
          // Audio+Video mode: Must sync both elements
          return cy.get("audio").then(([audio]) => {
            return cy.get("video").then(([video]) => {
              const timeDiff = Math.abs(audio.currentTime - video.currentTime);
              const rateDiff = Math.abs(audio.playbackRate - video.playbackRate);

              if (timeDiff <= tolerance && rateDiff <= tolerance) {
                cy.log(`🎯 Media sync achieved! Time diff: ${timeDiff.toFixed(3)}s, Rate diff: ${rateDiff.toFixed(3)}`);
                return cy.wrap(null);
              }
              cy.log(`🔄 Media syncing... Time diff: ${timeDiff.toFixed(3)}s, Rate diff: ${rateDiff.toFixed(3)}`);
              cy.wait(50);
              return checkSync();
            });
          });
        }
        // Audio-only mode - no sync needed
        cy.log("🎯 Audio-only mode - sync achieved!");
        return cy.wrap(null);
      };

      cy.log(`🏁 Waiting for ${checkVideo ? "audio/video" : "audio-only"} synchronization...`);
      return checkSync();
    }

    /**
     * Waits for audio/video to be in a specific play state
     * @param shouldBePlaying expected play state
     * @param timeout maximum time to wait
     * @param checkVideo whether to check video state (default: true)
     */
    waitForPlayState(shouldBePlaying: boolean, timeout = 8000, checkVideo = true) {
      cy.log(
        `🎵 Waiting for ${checkVideo ? "audio/video" : "audio"} to ${shouldBePlaying ? "start playing" : "be paused"}...`,
      );

      return cy
        .get("audio", { timeout })
        .should(([audio]) => {
          expect(audio.paused).to.equal(!shouldBePlaying);
        })
        .then(() => {
          if (checkVideo) {
            return cy.get("video").should(([video]) => {
              expect(video.paused).to.equal(!shouldBePlaying);
            });
          }
          return cy.wrap(null);
        });
    }

    /**
     * Waits for audio/video playback rate to reach expected value
     * @param expectedRate expected playback rate
     * @param timeout maximum time to wait
     * @param checkVideo whether to check video rate (default: true)
     */
    waitForPlaybackRate(expectedRate: number, timeout = 8000, checkVideo = true) {
      cy.log(`🎵 Waiting for ${checkVideo ? "audio/video" : "audio"} playback rate to be ${expectedRate}x...`);

      return cy
        .get("audio", { timeout })
        .should(([audio]) => {
          expect(audio.playbackRate).to.equal(expectedRate);
        })
        .then(() => {
          if (checkVideo) {
            return cy.get("video").should(([video]) => {
              expect(video.playbackRate).to.equal(expectedRate);
            });
          }
          return cy.wrap(null);
        });
    }

    /**
     * Waits for audio/video current time to stabilize (not changing)
     * @param tolerance tolerance for time changes
     * @param stabilityDuration how long to be stable (ms)
     * @param timeout maximum time to wait
     */
    waitForTimeStabilization(tolerance = 0.01, stabilityDuration = 200, timeout = 8000) {
      let lastAudioTime: number | null = null;
      let lastVideoTime: number | null = null;
      let stableStartTime: number | null = null;

      const checkStability = (): Cypress.Chainable => {
        return cy.get("audio").then(([audio]) => {
          return cy.get("body").then(($body) => {
            const currentTime = Date.now();
            const audioTimeDiff =
              lastAudioTime !== null ? Math.abs(audio.currentTime - lastAudioTime) : Number.POSITIVE_INFINITY;

            if ($body.find("video").length > 0) {
              return cy.get("video").then(([video]) => {
                const videoTimeDiff =
                  lastVideoTime !== null ? Math.abs(video.currentTime - lastVideoTime) : Number.POSITIVE_INFINITY;

                if (audioTimeDiff <= tolerance && videoTimeDiff <= tolerance) {
                  if (!stableStartTime) {
                    stableStartTime = currentTime;
                    cy.log("🔄 Media time starting to stabilize...");
                  } else if (currentTime - stableStartTime >= stabilityDuration) {
                    cy.log("✅ Media time stabilized!");
                    return cy.wrap(null);
                  }
                } else {
                  stableStartTime = null;
                }

                lastAudioTime = audio.currentTime;
                lastVideoTime = video.currentTime;

                if (currentTime - (stableStartTime || currentTime) > timeout) {
                  cy.log("⏰ Time stabilization timeout");
                  return cy.wrap(null);
                }

                cy.wait(16); // One frame
                return checkStability();
              });
            }
            // Audio-only mode
            if (audioTimeDiff <= tolerance) {
              if (!stableStartTime) {
                stableStartTime = currentTime;
                cy.log("🔄 Audio time starting to stabilize...");
              } else if (currentTime - stableStartTime >= stabilityDuration) {
                cy.log("✅ Audio time stabilized!");
                return cy.wrap(null);
              }
            } else {
              stableStartTime = null;
            }

            lastAudioTime = audio.currentTime;

            if (currentTime - (stableStartTime || currentTime) > timeout) {
              cy.log("⏰ Time stabilization timeout");
              return cy.wrap(null);
            }

            cy.wait(16); // One frame
            return checkStability();
          });
        });
      };

      cy.log("🏁 Waiting for media time to stabilize...");
      return checkStability();
    }

    zoomIn({ times = 1, speed = 4 }) {
      cy.log(`Zoom in by ${times} times)`);
      for (let i = 0; i < times; i++) {
        this.visualizer.trigger("wheel", "center", "center", {
          deltaY: -speed,
          ctrlKey: true,
          metaKey: true,
        });
      }
    }

    scroll({ times = 1, speed = 4, backward = false }) {
      cy.log(`Scroll by ${times} times)`);
      for (let i = 0; i < times; i++) {
        this.visualizer.trigger("wheel", "center", "center", {
          deltaX: 0,
          deltaY: backward ? -speed : speed,
        });
      }
    }

    /**
     * Checks if an error message is displayed in the audio view
     * @param {string} errorText - The error text to check for
     */
    hasError(errorText: string) {
      cy.log(`Checking for error message: "${errorText}"`);
      this.errorContainer.should("exist");
      this.errorContainer.contains(errorText).should("exist");
    }
  },
) {}

const AudioView = new AudioViewHelper("&:eq(0)");
const useAudioView = (rootSelector: string) => {
  return new AudioViewHelper(rootSelector);
};

export { AudioView, useAudioView };
