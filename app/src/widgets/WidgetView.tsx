// Sceglie il componente giusto per il tipo di widget. I tipi non ancora implementati usano un segnaposto.
import { StyleSheet, Text } from 'react-native';
import { ButtonWidget, MenuWidget, SegmentedWidget, StyledButtonWidget, TerminalWidget, TimeInputWidget } from './controls';
import { FONT } from '@/ui/fonts';
import { LabeledValue, Led, ValueDisplay } from './displays';
import { GaugeWidget, LevelWidget } from './gauges';
import { NumberInputWidget, TextInputWidget } from './inputs';
import { LinkButtonWidget, PlayerWidget, TableWidget } from './extras';
import { JoystickWidget } from './joystick';
import { LcdWidget } from './lcd';
import { ImageGalleryWidget, TimerWidget } from './misc';
import { MapWidget } from './map/MapWidget';
import { GpsStreamWidget, GpsTriggerWidget, SensorIconWidget, SensorValueWidget } from './sensors';
import { RgbWidget, SliderWidget, StepWidget, VerticalSliderWidget } from './sliders';
import { VideoWidget } from './VideoWidget';
import { SuperChartWidget } from './superchart/SuperChart';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

const TYPE_NAMES: Record<string, string> = {
  NOTIFICATION: 'Notification',
};

function Placeholder({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.center}>
      <Text style={[styles.placeholder, { color: theme.text }]} numberOfLines={1}>
        {TYPE_NAMES[widget.type] ?? widget.type}
      </Text>
    </WidgetFrame>
  );
}

export function WidgetView(props: WidgetViewProps) {
  switch (props.widget.type) {
    case 'DIGIT4_DISPLAY':
      return <ValueDisplay {...props} />;
    case 'LABELED_VALUE_DISPLAY':
      return <LabeledValue {...props} />;
    case 'LED':
      return <Led {...props} />;
    case 'BUTTON':
      return <ButtonWidget {...props} />;
    case 'STYLED_BUTTON':
      return <StyledButtonWidget {...props} />;
    case 'MENU':
      return <MenuWidget {...props} />;
    case 'SEGMENTED_CONTROL':
      return <SegmentedWidget {...props} />;
    case 'TIME_INPUT':
      return <TimeInputWidget {...props} />;
    case 'TERMINAL':
      return <TerminalWidget {...props} />;
    case 'SLIDER':
      return <SliderWidget {...props} />;
    case 'VERTICAL_SLIDER':
      return <VerticalSliderWidget {...props} />;
    case 'STEP':
    case 'VERTICAL_STEP':
      return <StepWidget {...props} />;
    case 'RGB':
      return <RgbWidget {...props} />;
    case 'TABLE':
      return <TableWidget {...props} />;
    case 'PLAYER':
      return <PlayerWidget {...props} />;
    case 'LINK_BUTTON':
      return <LinkButtonWidget {...props} />;
    case 'TIMER':
      return <TimerWidget {...props} />;
    case 'TWO_AXIS_JOYSTICK':
      return <JoystickWidget {...props} />;
    case 'IMAGE':
      return <ImageGalleryWidget {...props} />;
    case 'LCD':
      return <LcdWidget {...props} />;
    case 'TEXT_INPUT':
      return <TextInputWidget {...props} />;
    case 'NUMBER_INPUT':
      return <NumberInputWidget {...props} />;
    case 'MAP':
      return <MapWidget {...props} />;
    case 'VIDEO':
      return <VideoWidget {...props} />;
    case 'GAUGE':
      return <GaugeWidget {...props} />;
    case 'LEVEL_DISPLAY':
    case 'VERTICAL_LEVEL_DISPLAY':
      return <LevelWidget {...props} />;
    case 'ENHANCED_GRAPH':
      return <SuperChartWidget {...props} />;
    case 'LIGHT':
    case 'PROXIMITY':
    case 'BAROMETER':
    case 'HUMIDITY':
    case 'TEMPERATURE':
      return <SensorValueWidget {...props} />;
    case 'ACCELEROMETER':
    case 'GRAVITY':
      return <SensorIconWidget {...props} />;
    case 'GPS_STREAMING':
      return <GpsStreamWidget {...props} />;
    case 'GPS_TRIGGER':
      return <GpsTriggerWidget {...props} />;
    default:
      return <Placeholder {...props} />;
  }
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  placeholder: { fontSize: 12, opacity: 0.35, fontFamily: FONT.regular },
});
