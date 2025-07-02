import React, { useState, useCallback, useRef } from 'react';
import { Button } from './ui/button';

interface StoryboardScene {
  id: string;
  title: string;
  description: string;
  duration: number;
  notes: string;
  connections: string[];
  position: { x: number; y: number };
  imageUrl?: string;
  shotType: 'wide' | 'medium' | 'close' | 'extreme-close';
}

interface StoryboardEditorProps {
  onAction: (action: string, data: any) => void;
  onChatRequest: () => void;
}

export const StoryboardEditor: React.FC<StoryboardEditorProps> = ({ onAction, onChatRequest }) => {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [draggedScene, setDraggedScene] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const handleAddScene = useCallback(() => {
    const newScene: StoryboardScene = {
      id: `scene-${Date.now()}`,
      title: `Scene ${scenes.length + 1}`,
      description: '',
      duration: 10,
      notes: '',
      connections: [],
      position: { 
        x: 100 + (scenes.length % 4) * 250, 
        y: 100 + Math.floor(scenes.length / 4) * 200 
      },
      shotType: 'medium',
    };

    setScenes(prev => [...prev, newScene]);
    onAction('add-scene', { scene: newScene });
  }, [scenes.length, onAction]);

  const handleConnectScenes = useCallback((fromId: string, toId: string) => {
    setScenes(prev => prev.map(scene => 
      scene.id === fromId 
        ? { ...scene, connections: [...scene.connections, toId] }
        : scene
    ));
    onAction('connect-scenes', { from: fromId, to: toId });
  }, [onAction]);

  const handleUpdateScene = useCallback((sceneId: string, updates: Partial<StoryboardScene>) => {
    setScenes(prev => prev.map(scene => 
      scene.id === sceneId ? { ...scene, ...updates } : scene
    ));
    onAction('update-scene', { sceneId, updates });
  }, [onAction]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    setScenes(prev => prev.filter(scene => scene.id !== sceneId));
    if (selectedScene === sceneId) {
      setSelectedScene(null);
    }
    onAction('delete-scene', { sceneId });
  }, [selectedScene, onAction]);

  const handleSceneClick = useCallback((sceneId: string) => {
    if (connectionMode) {
      if (!connectionStart) {
        setConnectionStart(sceneId);
      } else if (connectionStart !== sceneId) {
        handleConnectScenes(connectionStart, sceneId);
        setConnectionStart(null);
        setConnectionMode(false);
      }
    } else {
      setSelectedScene(sceneId);
    }
  }, [connectionMode, connectionStart, handleConnectScenes]);

  const handleMouseDown = useCallback((e: React.MouseEvent, sceneId: string) => {
    if (connectionMode) return;
    setDraggedScene(sceneId);
    e.preventDefault();
  }, [connectionMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedScene || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setScenes(prev => prev.map(scene => 
      scene.id === draggedScene 
        ? { ...scene, position: { x: x - 75, y: y - 50 } }
        : scene
    ));
  }, [draggedScene]);

  const handleMouseUp = useCallback(() => {
    if (draggedScene) {
      const scene = scenes.find(s => s.id === draggedScene);
      if (scene) {
        onAction('move-scene', { sceneId: draggedScene, position: scene.position });
      }
    }
    setDraggedScene(null);
  }, [draggedScene, scenes, onAction]);

  const renderScene = (scene: StoryboardScene) => {
    const isSelected = selectedScene === scene.id;
    const isConnectionStart = connectionStart === scene.id;
    
    return (
      <div
        key={scene.id}
        className={`absolute bg-white border-2 rounded-lg shadow-lg cursor-pointer transition-all ${
          isSelected ? 'border-blue-500 shadow-xl' : 'border-gray-300'
        } ${isConnectionStart ? 'border-green-500 shadow-green-300' : ''}`}
        style={{
          left: scene.position.x,
          top: scene.position.y,
          width: 200,
          height: 150,
        }}
        onClick={() => handleSceneClick(scene.id)}
        onMouseDown={(e) => handleMouseDown(e, scene.id)}
        onDoubleClick={() => onChatRequest()}
      >
        {/* Scene thumbnail area */}
        <div className="h-20 bg-gray-100 rounded-t-md flex items-center justify-center border-b">
          {scene.imageUrl ? (
            <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover rounded-t-md" />
          ) : (
            <div className="text-gray-400 text-xs text-center">
              <div className="text-2xl mb-1">🎬</div>
              {scene.shotType}
            </div>
          )}
        </div>

        {/* Scene info */}
        <div className="p-2">
          <div className="font-semibold text-sm truncate">{scene.title}</div>
          <div className="text-xs text-gray-600 mt-1">{scene.duration}s</div>
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {scene.description || 'No description'}
          </div>
        </div>

        {/* Scene number */}
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
          {scenes.indexOf(scene) + 1}
        </div>

        {/* Connection points */}
        <div className="absolute -right-2 top-1/2 w-4 h-4 bg-green-500 rounded-full transform -translate-y-1/2 flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      </div>
    );
  };

  const renderConnections = () => {
    return scenes.map(scene => 
      scene.connections.map(targetId => {
        const targetScene = scenes.find(s => s.id === targetId);
        if (!targetScene) return null;

        const startX = scene.position.x + 200;
        const startY = scene.position.y + 75;
        const endX = targetScene.position.x;
        const endY = targetScene.position.y + 75;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
          <g key={`${scene.id}-${targetId}`}>
            <path
              d={`M ${startX} ${startY} Q ${midX} ${midY - 50} ${endX} ${endY}`}
              stroke="#3B82F6"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          </g>
        );
      })
    ).flat();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="bg-gray-100 p-4 border-b flex items-center space-x-4">
        <h2 className="text-lg font-semibold">Storyboard Editor</h2>
        
        <div className="flex space-x-2">
          <Button onClick={handleAddScene} variant="outline" size="sm">
            Add Scene
          </Button>
          <Button 
            onClick={() => {
              setConnectionMode(!connectionMode);
              setConnectionStart(null);
            }}
            variant={connectionMode ? "default" : "outline"}
            size="sm"
          >
            {connectionMode ? 'Cancel Connect' : 'Connect Scenes'}
          </Button>
          <Button 
            onClick={() => {
              if (selectedScene) {
                handleDeleteScene(selectedScene);
              }
            }}
            variant="outline" 
            size="sm"
            disabled={!selectedScene}
          >
            Delete Scene
          </Button>
        </div>

        <div className="flex items-center space-x-2 ml-auto">
          <span className="text-sm">
            {scenes.length} scenes | Total: {scenes.reduce((sum, s) => sum + s.duration, 0)}s
          </span>
          <Button onClick={onChatRequest} variant="outline" size="sm">
            Ask AI
          </Button>
        </div>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex">
        <div 
          ref={boardRef}
          className="flex-1 relative bg-gray-50 overflow-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(#ccc 1px, transparent 1px),
                linear-gradient(90deg, #ccc 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />

          {/* Connection lines SVG */}
          <svg className="absolute inset-0 pointer-events-none">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#3B82F6"
                />
              </marker>
            </defs>
            {renderConnections()}
          </svg>

          {/* Scenes */}
          {scenes.map(renderScene)}

          {/* Instructions overlay */}
          {scenes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold mb-2">Start Your Storyboard</h3>
                <p className="text-sm">Click "Add Scene" to begin planning your story</p>
              </div>
            </div>
          )}

          {/* Connection mode instructions */}
          {connectionMode && (
            <div className="absolute top-4 left-4 bg-green-100 border border-green-300 rounded-lg p-3">
              <div className="text-green-800 text-sm">
                {!connectionStart 
                  ? 'Click on the first scene to start connection'
                  : 'Click on the target scene to complete connection'
                }
              </div>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        {selectedScene && (
          <div className="w-80 bg-white border-l p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4">Scene Properties</h3>
            
            {(() => {
              const scene = scenes.find(s => s.id === selectedScene);
              if (!scene) return null;

              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={scene.title}
                      onChange={(e) => handleUpdateScene(scene.id, { title: e.target.value })}
                      className="w-full p-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={scene.description}
                      onChange={(e) => handleUpdateScene(scene.id, { description: e.target.value })}
                      className="w-full p-2 border rounded h-20 resize-none"
                      placeholder="Describe what happens in this scene..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      value={scene.duration}
                      onChange={(e) => handleUpdateScene(scene.id, { duration: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 border rounded"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shot Type
                    </label>
                    <select
                      value={scene.shotType}
                      onChange={(e) => handleUpdateScene(scene.id, { shotType: e.target.value as any })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="wide">Wide Shot</option>
                      <option value="medium">Medium Shot</option>
                      <option value="close">Close-up</option>
                      <option value="extreme-close">Extreme Close-up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={scene.notes}
                      onChange={(e) => handleUpdateScene(scene.id, { notes: e.target.value })}
                      className="w-full p-2 border rounded h-16 resize-none"
                      placeholder="Production notes, camera angles, etc..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Connections ({scene.connections.length})
                    </label>
                    <div className="text-xs text-gray-500">
                      {scene.connections.length === 0 
                        ? 'No connections yet'
                        : scene.connections.map(connId => {
                            const connScene = scenes.find(s => s.id === connId);
                            return connScene ? connScene.title : 'Unknown';
                          }).join(', ')
                      }
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}; 