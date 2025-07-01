import { ChatInterface } from "./ChatInterface";
import "./index.css";

import logo from "./logo.svg";
import reactLogo from "./react.svg";

export function App() {
  return (
    <div className="container mx-auto p-8 text-center relative z-10">
      <div className="flex justify-center items-center gap-8 mb-8">
        <img
          src={logo}
          alt="Bun Logo"
          className="h-24 p-4 transition-all duration-300 hover:drop-shadow-[0_0_2em_#646cffaa]"
        />
        <h1 className="text-5xl font-bold">ClarityAI</h1>
        <img
          src={reactLogo}
          alt="React Logo"
          className="h-24 p-4 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] [animation:spin_20s_linear_infinite]"
        />
      </div>

      <p className="text-muted-foreground mb-8">
        Powered by Daydreams AI and OpenRouter
      </p>

      <ChatInterface />
    </div>
  );
}

export default App;
