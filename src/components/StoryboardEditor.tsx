import React, { useState, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link, Trash2, Maximize, Mic, Video, Type, Image as ImageIcon } from 'lucide-react';

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
  icon: 'video' | 'audio' | 'text' | 'image';
}

interface StoryboardEditorProps {
  onAction: (action: string, data: any) => void;
  onChatRequest: () => void;
}

export const StoryboardEditor: React.FC<StoryboardEditorProps> = ({ onAction, onChatRequest }) => {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  const handleAddScene = useCallback(() => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    const x = boardRect ? Math.random() * (boardRect.width - 250) + 20 : 100 + (scenes.length % 5) * 50;
    const y = boardRect ? Math.random() * (boardRect.height - 250) + 20 : 100 + (scenes.length % 5) * 50;

    const newScene: StoryboardScene = {
      id: `scene-${Date.now()}`,
      title: `Scene ${scenes.length + 1}`,
      description: '',
      duration: 10,
      notes: '',
      connections: [],
      position: { x, y },
      shotType: 'medium',
      icon: 'video',
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

  const renderScene = (scene: StoryboardScene) => {
    const isSelected = selectedScene === scene.id;
    const isConnectionStart = connectionStart === scene.id;

    const getIcon = () => {
      switch(scene.icon) {
        case 'video': return <Video className="w-6 h-6 text-gray-400" />;
        case 'audio': return <Mic className="w-6 h-6 text-gray-400" />;
        case 'text': return <Type className="w-6 h-6 text-gray-400" />;
        case 'image': return <ImageIcon className="w-6 h-6 text-gray-400" />;
        default: return <Video className="w-6 h-6 text-gray-400" />;
      }
    };
    
    return (
      <motion.div
        key={scene.id}
        id={scene.id}
        layout
        drag
        dragConstraints={boardRef}
        dragMomentum={false}
        onDragEnd={(event, info) => {
          const boardRect = boardRef.current?.getBoundingClientRect();
          if (boardRect) {
            handleUpdateScene(scene.id, { 
              position: { 
                x: info.point.x - boardRect.left, 
                y: info.point.y - boardRect.top 
              }
            });
          }
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`absolute bg-white rounded-xl shadow-lg cursor-grab active:cursor-grabbing transition-shadow ${
          isSelected ? 'ring-2 ring-blue-500 shadow-2xl' : ''
        }`}
        style={{
          left: scene.position.x,
          top: scene.position.y,
          width: 220,
        }}
        onClick={() => handleSceneClick(scene.id)}
        onDoubleClick={() => onChatRequest()}
      >
        {/* Scene thumbnail area */}
        <div className="h-28 bg-gray-100 rounded-t-xl flex items-center justify-center border-b">
          {scene.imageUrl ? (
            <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover rounded-t-xl" />
          ) : (
            <div className="text-gray-400 text-xs text-center p-2">
              {getIcon()}
              <p className="mt-2 font-medium">{scene.shotType}</p>
            </div>
          )}
        </div>

        {/* Scene info */}
        <div className="p-3">
          <div className="font-bold text-sm truncate">{scene.title}</div>
          <div className="text-xs text-gray-500 mt-1">{scene.duration}s</div>
          <div className="text-xs text-gray-600 mt-2 h-8 line-clamp-2">
            {scene.description || 'No description'}
          </div>
        </div>

        {/* Scene number */}
        <div className="absolute -top-2 -left-2 w-7 h-7 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white">
          {scenes.indexOf(scene) + 1}
        </div>

        {/* Connection points */}
        <div 
          className="absolute -right-2 top-1/2 w-5 h-5 bg-gray-300 hover:bg-green-500 rounded-full transform -translate-y-1/2 flex items-center justify-center cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setConnectionMode(true);
            setConnectionStart(scene.id);
          }}
        >
          <Link className="w-3 h-3 text-white" />
        </div>
      </motion.div>
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
              stroke="#4b5563"
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
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="bg-gray-950/70 backdrop-blur-sm p-3 border-b border-white/10 flex items-center space-x-2">
        <h2 className="text-lg font-bold text-gray-200">Storyboard</h2>
        
        <div className="flex-grow" />

        <Button onClick={handleAddScene} variant="ghost" size="sm" className="flex items-center gap-2 text-gray-300 hover:text-white">
          <Plus className="w-4 h-4" /> Add Scene
        </Button>
        <Button 
          onClick={() => {
            setConnectionMode(!connectionMode);
            setConnectionStart(null);
          }}
          variant={connectionMode ? "secondary" : "ghost"}
          size="sm"
          className="flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <Link className="w-4 h-4" /> {connectionMode ? 'Cancel' : 'Connect'}
        </Button>
        <Button 
          onClick={() => {
            if (selectedScene) {
              handleDeleteScene(selectedScene);
            }
          }}
          variant="ghost" 
          size="sm"
          disabled={!selectedScene}
          className="flex items-center gap-2 text-red-500 hover:text-red-400 disabled:text-gray-600"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </Button>
        
        <div className="border-l border-white/10 h-6 mx-2" />

        <Button onClick={onChatRequest} variant="ghost" size="sm" className="text-gray-300 hover:text-white">
          Ask AI
        </Button>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex">
        <div 
          ref={boardRef}
          className="flex-1 relative bg-gray-900 overflow-hidden"
        >
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                radial-gradient(#6b7280 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
              backgroundPosition: 'center center'
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
                  fill="#4b5563"
                />
              </marker>
            </defs>
            {renderConnections()}
          </svg>

          {/* Scenes */}
          <AnimatePresence>
            {scenes.map(renderScene)}
          </AnimatePresence>

          {/* Instructions overlay */}
          {scenes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
        <AnimatePresence>
          {selectedScene && (
            <motion.div 
              key="properties-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-80 bg-gray-950/80 backdrop-blur-md border-l border-white/10 shadow-lg overflow-y-auto"
            >
              <div className="p-4">
                <h3 className="font-bold text-lg mb-4 text-gray-200">Scene Properties</h3>
                
                {(() => {
                  const scene = scenes.find(s => s.id === selectedScene);
                  if (!scene) return null;

                  return (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Icon
                        </label>
                        <select
                          value={scene.icon}
                          onChange={(e) => handleUpdateScene(scene.id, { icon: e.target.value as any })}
                          className="w-full p-2 border border-white/20 rounded-md bg-gray-800 text-white"
                        >
                          <option value="video">Video</option>
                          <option value="audio">Audio</option>
                          <option value="text">Text</option>
                          <option value="image">Image</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={scene.title}
                          onChange={(e) => handleUpdateScene(scene.id, { title: e.target.value })}
                          className="w-full p-2 border border-white/20 rounded-md bg-gray-800 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Description
                        </label>
                        <textarea
                          value={scene.description}
                          onChange={(e) => handleUpdateScene(scene.id, { description: e.target.value })}
                          className="w-full p-2 border border-white/20 rounded-md bg-gray-800 text-white h-20 resize-none"
                          placeholder="Describe what happens in this scene..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Duration (seconds)
                        </label>
                        <input
                          type="number"
                          value={scene.duration}
                          onChange={(e) => handleUpdateScene(scene.id, { duration: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 border border-white/20 rounded-md bg-gray-800 text-white"
                          min="1"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Shot Type
                        </label>
                        <select
                          value={scene.shotType}
                          onChange={(e) => handleUpdateScene(scene.id, { shotType: e.target.value as any })}
                          className="w-full p-2 border border-white/20 rounded-md bg-gray-800 text-white"
                        >
                          <option value="wide">Wide Shot</option>
                          <option value="medium">Medium Shot</option>
                          <option value="close">Close-up</option>
                          <option value="extreme-close">Extreme Close-up</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={scene.notes}
                          onChange={(e) => handleUpdateScene(scene.id, { notes: e.target.value })}
                          className="w-full p-2 border border-white/20 rounded-md bg-gray-800 text-white h-16 resize-none"
                          placeholder="Production notes, camera angles, etc..."
                        />
                      </div>

                      <div className="pt-2">
                        <Button 
                          onClick={() => handleDeleteScene(scene.id)} 
                          variant="destructive" 
                          size="sm"
                          className="w-full"
                        >
                          Delete Scene
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}; 