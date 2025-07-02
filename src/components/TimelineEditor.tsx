import React, { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';

interface TimelineClip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  type: 'video' | 'audio' | 'image';
  position: number;
}

interface TimelineEditorProps {
  onAction: (action: string, data: any) => void;
  onChatRequest: () => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({ onAction, onChatRequest }) => {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);

  const handleAddClip = useCallback(() => {
    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      name: `Clip ${clips.length + 1}`,
      startTime: playheadPosition,
      duration: 5,
      type: 'video',
      position: clips.length,
    };

    setClips(prev => [...prev, newClip]);
    onAction('add-clip', { clip: newClip });
  }, [clips.length, playheadPosition, onAction]);

  const handleSplitClip = useCallback(() => {
    if (!selectedClip) return;

    const clip = clips.find(c => c.id === selectedClip);
    if (!clip) return;

    const splitTime = playheadPosition - clip.startTime;
    if (splitTime <= 0 || splitTime >= clip.duration) return;

    const firstPart: TimelineClip = {
      ...clip,
      id: `${clip.id}-1`,
      duration: splitTime,
    };

    const secondPart: TimelineClip = {
      ...clip,
      id: `${clip.id}-2`,
      startTime: clip.startTime + splitTime,
      duration: clip.duration - splitTime,
      position: clip.position + 0.5,
    };

    setClips(prev => prev.filter(c => c.id !== selectedClip).concat([firstPart, secondPart]));
    onAction('split-clip', { originalClip: clip, splitTime, newClips: [firstPart, secondPart] });
  }, [selectedClip, clips, playheadPosition, onAction]);

  const handleTrimClip = useCallback((clipId: string, newDuration: number) => {
    setClips(prev => prev.map(clip => 
      clip.id === clipId ? { ...clip, duration: newDuration } : clip
    ));
    onAction('trim-clip', { clipId, newDuration });
  }, [onAction]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
    onAction(isPlaying ? 'pause' : 'play', { position: playheadPosition });
  }, [isPlaying, playheadPosition, onAction]);

  const renderClip = (clip: TimelineClip, index: number) => {
    const clipWidth = clip.duration * 50 * zoomLevel; // 50px per second
    const clipLeft = clip.startTime * 50 * zoomLevel;
    const isSelected = selectedClip === clip.id;

    return (
      <div
        key={clip.id}
        className={`absolute h-16 bg-blue-500 border-2 rounded cursor-pointer transition-all ${
          isSelected ? 'border-yellow-400 shadow-lg' : 'border-blue-600'
        }`}
        style={{
          left: clipLeft,
          width: Math.max(clipWidth, 20),
          top: index * 70 + 50,
        }}
        onClick={() => setSelectedClip(clip.id)}
        onDoubleClick={() => onChatRequest()}
      >
        <div className="p-2 text-white text-xs overflow-hidden">
          <div className="font-semibold">{clip.name}</div>
          <div>{clip.duration.toFixed(1)}s</div>
        </div>
        
        {/* Resize handles */}
        {isSelected && (
          <>
            <div
              className="absolute right-0 top-0 w-2 h-full bg-yellow-400 cursor-ew-resize"
              onMouseDown={(e) => {
                e.stopPropagation();
                // Handle resize logic here
              }}
            />
          </>
        )}
      </div>
    );
  };

  const renderPlayhead = () => {
    const playheadLeft = playheadPosition * 50 * zoomLevel;
    
    return (
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
        style={{ left: playheadLeft }}
      >
        <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
      </div>
    );
  };

  const renderTimeRuler = () => {
    const maxTime = Math.max(60, ...clips.map(c => c.startTime + c.duration));
    const intervals = [];
    
    for (let i = 0; i <= maxTime; i += 5) {
      const left = i * 50 * zoomLevel;
      intervals.push(
        <div key={i} className="absolute flex flex-col items-center" style={{ left }}>
          <div className="w-0.5 h-4 bg-gray-400" />
          <div className="text-xs text-gray-600 mt-1">{i}s</div>
        </div>
      );
    }
    
    return (
      <div className="relative h-8 bg-gray-100 border-b">
        {intervals}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="bg-gray-100 p-4 border-b flex items-center space-x-4">
        <h2 className="text-lg font-semibold">Timeline Editor</h2>
        
        <div className="flex space-x-2">
          <Button onClick={handleAddClip} variant="outline" size="sm">
            Add Clip
          </Button>
          <Button 
            onClick={handleSplitClip} 
            variant="outline" 
            size="sm"
            disabled={!selectedClip}
          >
            Split
          </Button>
          <Button onClick={handlePlayPause} variant="outline" size="sm">
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm">Zoom:</span>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="w-20"
          />
          <span className="text-sm">{(zoomLevel * 100).toFixed(0)}%</span>
        </div>

        <div className="flex items-center space-x-2 ml-auto">
          <span className="text-sm">Position: {playheadPosition.toFixed(1)}s</span>
          <Button onClick={onChatRequest} variant="outline" size="sm">
            Ask AI
          </Button>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="flex-1 overflow-auto">
        {renderTimeRuler()}
        
        <div 
          ref={timelineRef}
          className="relative bg-gray-50 min-h-full cursor-crosshair"
          onClick={(e) => {
            if (timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const newPosition = clickX / (50 * zoomLevel);
              setPlayheadPosition(Math.max(0, newPosition));
              onAction('seek', { position: newPosition });
            }
          }}
        >
          {/* Track lines */}
          {[0, 1, 2, 3, 4].map(trackIndex => (
            <div
              key={trackIndex}
              className="absolute w-full h-16 border-b border-gray-200"
              style={{ top: trackIndex * 70 + 50 }}
            >
              <div className="absolute left-0 top-0 w-20 h-full bg-gray-200 border-r flex items-center justify-center text-sm">
                Track {trackIndex + 1}
              </div>
            </div>
          ))}

          {/* Clips */}
          {clips.map((clip, index) => renderClip(clip, index))}

          {/* Playhead */}
          {renderPlayhead()}
        </div>
      </div>

      {/* Properties Panel */}
      {selectedClip && (
        <div className="bg-gray-100 p-4 border-t">
          <h3 className="font-semibold mb-2">Clip Properties</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-600">Name:</label>
              <input
                type="text"
                value={clips.find(c => c.id === selectedClip)?.name || ''}
                onChange={(e) => {
                  setClips(prev => prev.map(clip => 
                    clip.id === selectedClip ? { ...clip, name: e.target.value } : clip
                  ));
                }}
                className="w-full p-1 border rounded"
              />
            </div>
            <div>
              <label className="block text-gray-600">Duration:</label>
              <input
                type="number"
                step="0.1"
                value={clips.find(c => c.id === selectedClip)?.duration || 0}
                onChange={(e) => {
                  const newDuration = parseFloat(e.target.value);
                  if (newDuration > 0) {
                    handleTrimClip(selectedClip, newDuration);
                  }
                }}
                className="w-full p-1 border rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 