import type React from "react";
import { type FC, type MouseEvent, useContext, useEffect, useState } from "react";
import { Toggle } from "@humansignal/ui";
import { Block, Elem } from "../../../utils/bem";
import { IconConfig } from "@humansignal/ui";
import { TimelineContext } from "../../../components/Timeline/Context";
import { ControlButton } from "../../../components/Timeline/Controls";
import { Slider } from "../../../components/Timeline/Controls/Slider";
import "./ConfigControl.scss";
import { SpectrogramConfig } from "./SpectrogramConfig";
import type { Waveform } from "../Waveform";
import type { MutableRefObject } from "react";

const MAX_SPEED = 2.5;
const MAX_ZOOM = 150;
const MIN_SPEED = 0.5;
const MIN_ZOOM = 1;

export interface ConfigControlProps {
  configModal: boolean;
  speed: number;
  amp: number;
  onSetModal?: (e: MouseEvent<HTMLButtonElement>) => void;
  onSpeedChange: (speed: number) => void;
  onAmpChange: (amp: number) => void;
  toggleVisibility?: (layerName: string, isVisible: boolean) => void;
  layerVisibility?: Map<string, boolean>;
  waveform: MutableRefObject<Waveform | undefined>;
}

export const ConfigControl: FC<ConfigControlProps> = ({
  configModal,
  speed,
  amp,
  onSpeedChange,
  onSetModal,
  onAmpChange,
  toggleVisibility,
  layerVisibility,
  waveform,
}) => {
  const playbackSpeed = speed ?? 1;
  const [isTimeline, setTimeline] = useState(true);
  const [isAudioWave, setAudioWave] = useState(true);
  const { settings, changeSetting } = useContext(TimelineContext);

  useEffect(() => {
    if (layerVisibility) {
      const defaultDisplay = true;

      setTimeline(layerVisibility?.get?.("timeline") ?? defaultDisplay);
      setAudioWave(layerVisibility?.get?.("waveform") ?? defaultDisplay);
    }
  }, [layerVisibility]);

  const handleSetTimeline = () => {
    setTimeline(!isTimeline);
    toggleVisibility?.("timeline", !isTimeline);
  };

  const handleSetAudioWave = () => {
    setAudioWave(!isAudioWave);
    toggleVisibility?.("waveform", !isAudioWave);
    toggleVisibility?.("regions", !isAudioWave);
  };

  const handleChangePlaybackSpeed = (e: React.FormEvent<HTMLInputElement>) => {
    const _playbackSpeed = Number.parseFloat(e.currentTarget.value);

    if (isNaN(_playbackSpeed)) return;

    onSpeedChange(_playbackSpeed);
  };

  const handleChangeAmp = (e: React.FormEvent<HTMLInputElement>) => {
    const _amp = Number.parseFloat(e.currentTarget.value);

    onAmpChange(_amp);
  };

  const renderLayerToggles = () => {
    return (
      <Elem name={"buttons"}>
        <Elem name="menu-button" onClick={handleSetTimeline}>
          {isTimeline ? "Hide" : "Show"} timeline
        </Elem>
        <Elem name="menu-button" onClick={handleSetAudioWave}>
          {isAudioWave ? "Hide" : "Show"} audio wave
        </Elem>
      </Elem>
    );
  };

  const renderModal = () => {
    return (
      <Elem name="modal">
        <Slider
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={0.1}
          value={playbackSpeed}
          description={"Playback speed"}
          info={"Increase or decrease the playback speed"}
          onChange={handleChangePlaybackSpeed}
        />
        <Slider
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.1}
          value={amp}
          description={"Audio zoom y-axis"}
          info={"Increase or decrease the appearance of amplitude"}
          onChange={handleChangeAmp}
        />
        <Elem name="toggle">
          <Toggle
            checked={settings?.loopRegion}
            onChange={(e) => changeSetting?.("loopRegion", e.target.checked)}
            label="Loop Regions"
          />
        </Elem>
        <Elem name="toggle">
          <Toggle
            checked={settings?.autoPlayNewSegments}
            onChange={(e) => changeSetting?.("autoPlayNewSegments", e.target.checked)}
            label="Auto-play New Regions"
          />
        </Elem>
        {renderLayerToggles()}
        <SpectrogramConfig waveform={waveform} />
      </Elem>
    );
  };

  return (
    <Block name="audio-config" onClick={(e: MouseEvent<HTMLButtonElement>) => e.stopPropagation()}>
      <ControlButton look={configModal ? "active" : undefined} onClick={onSetModal}>
        {<IconConfig />}
      </ControlButton>
      {configModal && renderModal()}
    </Block>
  );
};
