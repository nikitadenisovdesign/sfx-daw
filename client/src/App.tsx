import { Transport } from "./components/Transport";
import { VideoPlayer } from "./components/VideoPlayer";
import { GeneratePanel } from "./components/GeneratePanel";
import { Timeline } from "./components/Timeline";
import { SoundBrowser } from "./components/SoundBrowser";

function App(): JSX.Element {
  return (
    <div className="app">
      <Transport />
      <VideoPlayer />
      <GeneratePanel />
      <Timeline />
      <div className="library-pane">
        <SoundBrowser />
      </div>
    </div>
  );
}

export default App;
