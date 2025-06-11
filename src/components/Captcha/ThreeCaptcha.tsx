import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

interface ThreeCaptchaProps {
  onVerify: (isVerified: boolean) => void;
}

const ROBOT_ARM_Y = 0.3;

// Robot arm class for physics simulation with Rapier
class RobotArm {
  cylinder: THREE.Mesh;
  rigidBody: RAPIER.RigidBody | null = null;
  position: THREE.Vector3;
  radius: number;
  world: RAPIER.World;

  constructor(world: RAPIER.World) {
    this.world = world;
    this.radius = 0.45; // 3cm diameter = 1.5cm radius = 0.45 units
    
    // Create visual cylinder
    const geometry = new THREE.CylinderGeometry(this.radius, this.radius, 0.8, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
    this.cylinder = new THREE.Mesh(geometry, material);
    this.cylinder.position.set(0, 0.4, 0);
    
    // Create physics body with Rapier
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Create collider (sphere for smooth interaction)
    const colliderDesc = RAPIER.ColliderDesc.ball(this.radius);
    world.createCollider(colliderDesc, this.rigidBody);
    
    this.rigidBody.setTranslation({ x: 0, y: 0.4, z: 0 }, true);
    
    this.position = this.cylinder.position;
  }

  setPosition(position: THREE.Vector3) {
    this.position.copy(position);
    this.cylinder.position.copy(position);
    if (this.rigidBody) {
      this.rigidBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    }
  }

  dispose() {
    if (this.rigidBody) {
      this.world.removeRigidBody(this.rigidBody);
    }
  }
}

const OuterBox = styled.div`
  width: 460px;
  padding: 32px 24px 24px 24px;
  background: #fafdff;
  border: 2.5px solid #2196f3;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Logo = styled.div`
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 1.6rem;
  font-weight: bold;
  color: #2196f3;
  letter-spacing: 2px;
  margin-bottom: 18px;
  text-shadow: 0 2px 8px rgba(33, 150, 243, 0.08);
`;

const CanvasFrame = styled.div`
  width: 400px;
  height: 400px;
  background: #fff;
  border: 1.5px solid #b3e5fc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Instructions = styled.div`
  margin-top: 12px;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
  line-height: 1.4;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
  align-items: center;
`;

const ControlButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: #2196f3;
          color: white;
          &:hover { background: #1976d2; }
          &:disabled { background: #ccc; cursor: not-allowed; }
        `;
      case 'danger':
        return `
          background: #f44336;
          color: white;
          &:hover { background: #d32f2f; }
          &:disabled { background: #ccc; cursor: not-allowed; }
        `;
      default:
        return `
          background: #e0e0e0;
          color: #333;
          &:hover { background: #d0d0d0; }
          &:disabled { background: #f5f5f5; color: #999; cursor: not-allowed; }
        `;
    }
  }}
`;

const StatusIndicator = styled.div<{ $isActive: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$isActive ? '#f44336' : '#ccc'};
  animation: ${props => props.$isActive ? 'blink 1s infinite' : 'none'};
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
  }
`;

const ApiKeyContainer = styled.div`
  width: 100%;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ApiKeyLabel = styled.label`
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
  text-align: left;
`;

const ApiKeyInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.85rem;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }
  
  &::placeholder {
    color: #999;
  }
`;

const VerificationResult = styled.div<{ $result: 'success' | 'failed' }>`
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  animation: fadeIn 0.3s ease-in-out;
  
  ${props => props.$result === 'success' ? `
    background: linear-gradient(135deg, #4caf50, #66bb6a);
    color: white;
    border: 2px solid #4caf50;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  ` : `
    background: linear-gradient(135deg, #f44336, #ef5350);
    color: white;
    border: 2px solid #f44336;
    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
  `}
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ThreeCaptcha: React.FC<ThreeCaptchaProps> = ({ onVerify }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const robotArmRef = useRef<RobotArm | null>(null);
  const objectsRef = useRef<Array<{ mesh: THREE.Mesh, body: RAPIER.RigidBody }>>([]);
  const lastTimeRef = useRef<number>(0);
  const worldRef = useRef<RAPIER.World | null>(null);
  const initializedRef = useRef<boolean>(false);
  // Refs that always hold the latest on/off state for the animation loop
  const isRecordingRef = useRef<boolean>(false);
  const isReplayingRef = useRef<boolean>(false);
  // Renderer ref for Gemini verification
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Recording and replay states
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  
  // Gemini API states
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [task, setTask] = useState('Move the robot arm to touch any of the 3D objects');
  const [verificationResult, setVerificationResult] = useState<'success' | 'failed' | null>(null);
  
  const recordingDataRef = useRef<Array<{
    timestamp: number;
    robotArm: { x: number, y: number, z: number };
    objects: Array<{
      position: { x: number, y: number, z: number };
      rotation: { x: number, y: number, z: number, w: number };
    }>;
  }>>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const replayStartTimeRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef<number>(0);

  // Recording and replay functions
  const startRecording = () => {
    console.log('🔴 startRecording function called!');
    console.log('🔴 Before setState - isReplaying:', isReplaying);
    
    if (isReplaying) {
      console.log('❌ Cannot start recording - currently replaying');
      return;
    }
    
    console.log('🔴 Clearing recording data...');
    recordingDataRef.current = [];
    frameCountRef.current = 0;
    
    console.log('🔴 Setting start time...');
    recordingStartTimeRef.current = performance.now();
    
    console.log('🔴 About to call setIsRecording(true)...');
    setIsRecording(true);
    isRecordingRef.current = true;
    
    // Start fixed 10fps recording interval (0.1s = 100ms)
    const targetFPS = 10;
    const frameInterval = 1000 / targetFPS; // 100ms
    
    recordingIntervalRef.current = setInterval(() => {
      if (isRecordingRef.current) {
        recordFixedFrame();
      }
    }, frameInterval);
    
    console.log('🔴 setIsRecording(true) called - Recording should start now!');
    console.log(`🔴 Recording started at fixed ${targetFPS}fps (${frameInterval}ms intervals)`);
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
    // Clear the recording interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    const frameCount = recordingDataRef.current.length;
    console.log('⏹️ Recording stopped. Frames:', frameCount);
    console.log('🎬 Recording data:', recordingDataRef.current.slice(0, 3)); // Show first 3 frames
    
    if (frameCount > 0) {
      setHasRecording(true);
      console.log('✅ Has recording set to true');
    } else {
      setHasRecording(false);
      console.log('❌ No recording data found');
    }
  };

  const startReplay = () => {
    console.log('🎮 Replay attempt - hasRecording:', hasRecording, 'isRecording:', isRecording);
    console.log('🎮 Recording data length:', recordingDataRef.current.length);
    
    if (!hasRecording || isRecording) {
      console.log('❌ Cannot start replay - conditions not met');
      return;
    }
    
    replayStartTimeRef.current = performance.now();
    setIsReplaying(true);
    isReplayingRef.current = true;
    console.log('▶️ Replay started with', recordingDataRef.current.length, 'frames');
  };

  const stopReplay = () => {
    setIsReplaying(false);
    isReplayingRef.current = false;
    console.log('⏹️ Replay stopped');
  };

  // Save current canvas as image file
  const saveCanvasImage = () => {
    if (!rendererRef.current) {
      console.log('❌ Renderer not ready');
      return;
    }

    const canvas = rendererRef.current.domElement;
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = imageDataUrl;
    downloadLink.download = `captcha-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    console.log('💾 Canvas image saved locally');
  };

  // Save recording data as CSV
  const saveRecordingAsCSV = () => {
    if (!hasRecording || recordingDataRef.current.length === 0) {
      alert('No recording data available to save!');
      return;
    }

    console.log('📊 Converting recording data to CSV...');
    
    // Get the first frame to determine object count
    const firstFrame = recordingDataRef.current[0];
    const objectCount = firstFrame.objects.length;
    
    // Create CSV header
    let csvHeader = 'Timestamp,RobotArm_X,RobotArm_Y,RobotArm_Z';
    
    // Add headers for each object's position and rotation
    for (let i = 0; i < objectCount; i++) {
      csvHeader += `,Object${i + 1}_Pos_X,Object${i + 1}_Pos_Y,Object${i + 1}_Pos_Z`;
      csvHeader += `,Object${i + 1}_Rot_X,Object${i + 1}_Rot_Y,Object${i + 1}_Rot_Z,Object${i + 1}_Rot_W`;
    }
    
    // Convert data to CSV rows
    const csvRows = recordingDataRef.current.map(frame => {
      let row = `${frame.timestamp.toFixed(3)},${frame.robotArm.x.toFixed(6)},${frame.robotArm.y.toFixed(6)},${frame.robotArm.z.toFixed(6)}`;
      
      // Add object data
      frame.objects.forEach(obj => {
        row += `,${obj.position.x.toFixed(6)},${obj.position.y.toFixed(6)},${obj.position.z.toFixed(6)}`;
        row += `,${obj.rotation.x.toFixed(6)},${obj.rotation.y.toFixed(6)},${obj.rotation.z.toFixed(6)},${obj.rotation.w.toFixed(6)}`;
      });
      
      return row;
    });
    
    // Combine header and data
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `captcha-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    console.log(`💾 Recording data saved as CSV: ${recordingDataRef.current.length} frames, ${objectCount} objects`);
  };

  // Gemini verification function
  const verifyWithGemini = async () => {
    console.log('🟢 Verifying with Gemini Flash 2.0…');

    if (!apiKey.trim()) {
      alert('Please enter your Gemini API key first!');
      return;
    }

    if (!rendererRef.current) {
      console.log('❌ Renderer not ready');
      onVerify(false);
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null); // Clear previous result

    try {
      // Capture canvas screenshot as PNG and convert to base64
      const canvas = rendererRef.current.domElement;
      const imageDataUrl = canvas.toDataURL('image/png');
      // Remove the "data:image/png;base64," prefix
      const base64Image = imageDataUrl.split(',')[1];

      const prompt = `Please analyze this 3D image carefully. The task is: "${task}".

Look at the image and determine if the specified task has been completed:

1. Carefully examine all elements in the scene:
   - Robot arm (gray cylindrical object)
   - Colored 3D cube objects
   - Their positions and interactions

2. Evaluate if the current scene matches the task requirement: "${task}"

3. Consider the task completed if:
   - The described action appears to have been performed
   - The scene shows reasonable evidence of task completion
   - Be somewhat lenient in interpretation (close proximity or interaction counts)

If the task appears to be completed based on what you can see in the image, respond with "VERIFIED" - otherwise respond with "NOT_VERIFIED".

Please respond with only "VERIFIED" or "NOT_VERIFIED" - no additional explanation needed.`;

      // 🔍 DEBUG: Log input data
      console.log('📤 INPUT - Prompt sent to Gemini:');
      console.log(prompt);
      console.log('📤 INPUT - Captured image (data URL):');
      console.log(imageDataUrl);
      console.log('📤 INPUT - Base64 image length:', base64Image.length, 'characters');

      const requestBody = {
        contents: [{
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Image
              }
            }
          ]
        }]
      };

      console.log('📤 INPUT - Full API request body:');
      console.log(JSON.stringify(requestBody, null, 2));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      // 🔍 DEBUG: Log full response
      console.log('📥 OUTPUT - Full API response:');
      console.log(JSON.stringify(data, null, 2));
      console.log('📥 OUTPUT - Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Gemini API Error: ${data.error?.message || 'Unknown error'}`);
      }

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('🤖 OUTPUT - Gemini final result:', result);

      const isVerified = result.toUpperCase().includes('VERIFIED') && !result.toUpperCase().includes('NOT_VERIFIED');
      
      if (isVerified) {
        console.log('✅ Gemini verified success - CAPTCHA PASSED!');
        setVerificationResult('success');
        onVerify(true);        // CAPTCHA passed!
      } else {
        console.log('❌ Gemini verification failed - try again');
        setVerificationResult('failed');
        onVerify(false);
      }
    } catch (err) {
      console.error('Gemini verification error:', err);
      alert(`Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setVerificationResult('failed');
      onVerify(false);
    } finally {
      setIsVerifying(false);
    }
  };

  // Coordinate normalization function
  const normalizeCoordinates = (x: number, y: number, z: number) => {
    // Real-world scale mapping:
    // Three.js: 6x6 unit table → Real world: 20x20cm table
    // Three.js: 0.75 unit cubes → Real world: 2.5x2.5cm cubes
    
    // Three.js coordinate ranges:
    // X: -3 to 3 (6 unit table width)  
    // Z: -3 to 3 (6 unit table depth)
    
    // Target coordinate ranges (real world units in meters):
    // X: 0.2 to 0.40 (20cm range, back to front)
    // Y: -0.20 to 0.20 (40cm range total, left to right, was Z axis)
    
    const normalizedX = 0.2 + ((x + 3) / 6) * (0.40 - 0.2); // -3~3 → 0.2~0.40 (20cm)
    const normalizedY = -0.20 + ((z + 3) / 6) * (0.20 - (-0.20)); // -3~3 → -0.20~0.20 (40cm total)
    
    return {
      x: Math.max(0.2, Math.min(0.40, normalizedX)),
      y: Math.max(-0.20, Math.min(0.20, normalizedY))
    };
  };

  // Reverse coordinate normalization for replay
  const denormalizeCoordinates = (normalizedX: number, normalizedY: number) => {
    // Convert normalized coordinates back to Three.js coordinates
    // X: 0.2~0.40 → -3~3
    // Y: -0.20~0.20 → -3~3 (this becomes Z in Three.js)
    
    const threeX = ((normalizedX - 0.2) / (0.40 - 0.2)) * 6 - 3; // 0.2~0.40 → -3~3
    const threeZ = ((normalizedY - (-0.20)) / (0.20 - (-0.20))) * 6 - 3; // -0.20~0.20 → -3~3
    
    return {
      x: threeX,
      z: threeZ
    };
  };

  // Record current state with fixed timestamp
  const recordFixedFrame = () => {
    if (!robotArmRef.current || !objectsRef.current) {
      console.log('❌ Missing refs for recording');
      return;
    }

    // Use fixed frame timing: frame number * 100ms (10fps)
    const fixedTimestamp = frameCountRef.current * (1000 / 10);
    const robotPos = robotArmRef.current.position;
    
    // Normalize robot arm coordinates
    const normalizedRobotPos = normalizeCoordinates(robotPos.x, robotPos.y, robotPos.z);
    
    const objectStates = objectsRef.current.map(obj => {
      // Normalize object coordinates
      const normalizedObjPos = normalizeCoordinates(obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z);
      
      return {
        position: {
          x: normalizedObjPos.x,  // Normalized X (0.2~0.40)
          y: normalizedObjPos.y,  // Normalized Y (was Z, -0.20~0.20)
          z: 0.76                 // Fixed Z value for all objects
        },
        rotation: {
          x: obj.mesh.quaternion.x,
          y: obj.mesh.quaternion.z, // Y와 Z 교환  
          z: obj.mesh.quaternion.y,
          w: obj.mesh.quaternion.w
        }
      };
    });

    recordingDataRef.current.push({
      timestamp: fixedTimestamp,
      robotArm: { 
        x: normalizedRobotPos.x,  // Normalized X (0.2~0.40)
        y: normalizedRobotPos.y,  // Normalized Y (was Z, -0.20~0.20)
        z: 0.76                   // Fixed Z value
      },
      objects: objectStates
    });

    frameCountRef.current++;

    // Log every 10 frames (exactly every second at 10fps)
    if (frameCountRef.current % 10 === 0) {
      console.log(`📹 Recording... ${frameCountRef.current} frames (${(fixedTimestamp / 1000).toFixed(1)}s)`);
    }
  };

  // Legacy record frame (for non-recording usage)
  const recordFrame = () => {
    // This is now only used for non-recording animation loops
    // The actual recording uses recordFixedFrame with setInterval
    return;
  };

  // Replay frame
  const replayFrame = () => {
    if (!isReplayingRef.current || !robotArmRef.current || !objectsRef.current) return;

    const currentTime = performance.now() - replayStartTimeRef.current;
    const frame = recordingDataRef.current.find(f => f.timestamp >= currentTime);
    
    if (frame) {
      // Denormalize robot arm position back to Three.js coordinates
      const robotArmThreePos = denormalizeCoordinates(frame.robotArm.x, frame.robotArm.y);
      robotArmRef.current.setPosition(new THREE.Vector3(
        robotArmThreePos.x,
        ROBOT_ARM_Y, // Use actual robot arm height, not the fixed CSV value
        robotArmThreePos.z
      ));

      // Set object positions and rotations
      frame.objects.forEach((objState, index) => {
        if (objectsRef.current[index]) {
          const obj = objectsRef.current[index];
          
          // Denormalize object position back to Three.js coordinates
          const objThreePos = denormalizeCoordinates(objState.position.x, objState.position.y);
          
          // Use actual object height from physics simulation, not the fixed CSV value
          // Objects settle on table at height = cube_size/2 = 0.75/2 = 0.375
          const actualHeight = 0.375; // Half of cube size (0.75), resting on table
          
          obj.mesh.position.set(objThreePos.x, actualHeight, objThreePos.z);
          obj.mesh.quaternion.set(objState.rotation.x, objState.rotation.z, objState.rotation.y, objState.rotation.w);
          
          // Also update physics body
          obj.body.setTranslation({x: objThreePos.x, y: actualHeight, z: objThreePos.z}, true);
          obj.body.setRotation({x: objState.rotation.x, y: objState.rotation.z, z: objState.rotation.y, w: objState.rotation.w}, true);
        }
      });
    } else if (currentTime > recordingDataRef.current[recordingDataRef.current.length - 1]?.timestamp) {
      // Replay finished
      stopReplay();
    }
  };

  // Clear verification result when user makes changes
  const clearVerificationResult = () => {
    if (verificationResult) {
      setVerificationResult(null);
    }
  };

  useEffect(() => {
    // Simple duplicate prevention using ref
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;
    
    // Initialize Rapier physics world
    const initPhysics = async () => {
      if (!isMounted) return;
      
      await RAPIER.init();
      
      if (!isMounted || !mountRef.current) return;
      
      // Create physics world with gravity
      const gravity = { x: 0.0, y: -9.82, z: 0.0 };
      const world = new RAPIER.World(gravity);
      worldRef.current = world;
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f5f5);
      const camera = new THREE.PerspectiveCamera(60, 400 / 400, 0.1, 1000); // Reduced FOV for zoom effect
      camera.position.set(0, 5, 5); // Moved camera closer
      camera.lookAt(0, 0, 0);
      // NOTE: `preserveDrawingBuffer: true` is required so that the framebuffer's
      // pixels remain available when we later call `toDataURL()` for a screenshot.
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true   // <-- keep the frame for screenshots
      });
      rendererRef.current = renderer; // Store renderer reference for Gemini verification
      renderer.setSize(400, 400);
      if (mountRef.current) {
        mountRef.current.appendChild(renderer.domElement);
      }
      
      // Light
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 7.5);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      
      // Ground (테이블처럼 보이게)
      const groundGeometry = new THREE.PlaneGeometry(6, 6);
      const groundMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513, // 갈색 나무 테이블
        shininess: 20
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      // Create ground physics body
      const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
      const groundBody = world.createRigidBody(groundBodyDesc);
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(3.0, 0.1, 3.0);
      groundColliderDesc.setTranslation(0, -0.1, 0);
      world.createCollider(groundColliderDesc, groundBody);

      // Create robot arm
      const robotArm = new RobotArm(world);
      scene.add(robotArm.cylinder);
      robotArmRef.current = robotArm;

      // Create multiple 3D objects (cubes and cylinders) without overlapping
      const objects: Array<{ mesh: THREE.Mesh, body: RAPIER.RigidBody }> = [];
      const occupiedPositions: Array<{ x: number, z: number, radius: number }> = [];
      
      // Define colors for objects (Fixed mapping for data analysis)
      const colors = [
        0xff0000, // Object1 = Red
        0x00ff00, // Object2 = Green  
        0x0000ff  // Object3 = Blue
      ];
      
      // Create exactly 3 objects (red, green, blue)
      const numObjects = 3; // Fixed 3 objects
      
      // Function to check if a position is too close to existing objects or robot arm
      const isPositionValid = (x: number, z: number, radius: number): boolean => {
        const minDistance = radius * 4; // Reduced from 8 to allow more interaction
        
        // Check distance from robot arm (starts at 0, 0.4, 0 with radius 0.45)
        const robotArmX = 0;
        const robotArmZ = 0;
        const robotArmRadius = 0.45;
        const distanceFromRobotArm = Math.sqrt(Math.pow(x - robotArmX, 2) + Math.pow(z - robotArmZ, 2));
        const minDistanceFromRobotArm = robotArmRadius + radius + 0.5; // Extra safety margin
        
        if (distanceFromRobotArm < minDistanceFromRobotArm) {
          return false; // Too close to robot arm
        }
        
        // Check distance from other objects
        for (const pos of occupiedPositions) {
          const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(z - pos.z, 2));
          if (distance < minDistance + pos.radius * 2) { // Reduced safety margin
            return false;
          }
        }
        return true;
      };
      
      for (let i = 0; i < numObjects; i++) {
        // Create uniform cubes only (removed cylinder option)
        let geometry: THREE.BufferGeometry;
        let colliderDesc: RAPIER.ColliderDesc;
        let objectRadius: number;
        
        // Create uniform sized cubes (2.5cm in 20cm table = 12.5% ratio)
        // Table is 6 units, so cube should be 6 * 0.125 = 0.75 units
        const size = 0.75; // Real scale: 2.5cm cubes on 20cm table
        geometry = new THREE.BoxGeometry(size, size, size);
        colliderDesc = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
        objectRadius = size * 1.2; // Reasonable safety radius
        
        // Create visual mesh with fixed color mapping
        // Object1 (i=0) = Red, Object2 (i=1) = Green, Object3 (i=2) = Blue
        const material = new THREE.MeshPhongMaterial({ 
          color: colors[i], // Fixed color mapping: 0=Red, 1=Green, 2=Blue
          shininess: 30
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Find a valid position that doesn't overlap with existing objects
        let x: number, z: number;
        let attempts = 0;
        const maxAttempts = 100; // Reduced attempts for faster placement
        
        do {
          x = (Math.random() - 0.5) * 3.5; // Larger area: Random x between -1.75 and 1.75
          z = (Math.random() - 0.5) * 3.5; // Larger area: Random z between -1.75 and 1.75
          attempts++;
        } while (!isPositionValid(x, z, objectRadius) && attempts < maxAttempts);
        
        // If we couldn't find a valid position, place it in a grid pattern with reasonable spacing
        if (attempts >= maxAttempts) {
          const gridSize = Math.ceil(Math.sqrt(numObjects));
          const gridIndex = occupiedPositions.length;
          const gridX = (gridIndex % gridSize) - gridSize / 2;
          const gridZ = Math.floor(gridIndex / gridSize) - gridSize / 2;
          x = gridX * 1.2; // Reasonable grid spacing
          z = gridZ * 1.2;
        }
        
        const y = 2.5; // Moderate height for natural falling
        
        mesh.position.set(x, y, z);
        scene.add(mesh);
        
        // Create physics body with Rapier - balanced settings for interaction
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
        // Enable CCD (Continuous Collision Detection) to prevent tunneling
        rigidBodyDesc.setCcdEnabled(true);
        const body = world.createRigidBody(rigidBodyDesc);
        body.setTranslation({ x, y, z }, true);
        
        // Set balanced mass and collision properties for good interaction
        colliderDesc.setMass(8.0); // Moderate mass for stability but allow movement
        colliderDesc.setFriction(0.8); // Good friction but not excessive
        colliderDesc.setRestitution(0.1); // Some bouncing for natural interaction
        // Keep collision groups for good detection
        colliderDesc.setCollisionGroups(0x00010001);
        world.createCollider(colliderDesc, body);
        
        // Add moderate damping for stability but allow interaction
        body.setLinearDamping(0.5);
        body.setAngularDamping(0.6);
        
        // Allow full rotation for natural physics
        // Remove the lockRotations call for natural interaction
        
        objects.push({ mesh, body });
        occupiedPositions.push({ x, z, radius: objectRadius });
      }
      
      objectsRef.current = objects;

      // Mouse/touch interaction variables
      let isDragging = false;

      const getPointerPosition = (event: MouseEvent | TouchEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        let clientX: number, clientY: number;
        
        if ('touches' in event) {
          clientX = event.touches[0].clientX;
          clientY = event.touches[0].clientY;
        } else {
          clientX = event.clientX;
          clientY = event.clientY;
        }
        
        return new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
      };

      const onPointerDown = (event: MouseEvent | TouchEvent) => {
        event.preventDefault();
        const pointer = getPointerPosition(event);
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);
        const intersection = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        
        if (intersection) {
          isDragging = true;
          robotArm.setPosition(new THREE.Vector3(intersection.x, ROBOT_ARM_Y, intersection.z));
        }
      };

      const onPointerMove = (event: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        
        event.preventDefault();
        const pointer = getPointerPosition(event);
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);
        const intersection = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        
        if (intersection) {
          robotArm.setPosition(new THREE.Vector3(intersection.x, ROBOT_ARM_Y, intersection.z));
          
          // Convert to normalized coordinates for display
          const normalizedPos = normalizeCoordinates(intersection.x, ROBOT_ARM_Y, intersection.z);
          console.log(`🤖 Robot arm position (normalized): x=${normalizedPos.x.toFixed(3)}, y=${normalizedPos.y.toFixed(3)}, z=0.760`);
          console.log(`🤖 Robot arm position (raw): x=${intersection.x.toFixed(2)}, y=${ROBOT_ARM_Y.toFixed(2)}, z=${intersection.z.toFixed(2)}`);
          
          // Log distances to objects for debugging (removed verification trigger)
          objects.forEach((obj, index) => {
            const objPos = obj.mesh.position;
            const distance = Math.sqrt(
              Math.pow(intersection.x - objPos.x, 2) +
              Math.pow(intersection.z - objPos.z, 2)
            );
            
            // Also show normalized object position
            const normalizedObjPos = normalizeCoordinates(objPos.x, objPos.y, objPos.z);
            const colors = ['Red', 'Green', 'Blue'];
            console.log(`📏 ${colors[index]} object (Object${index + 1}) - Normalized: x=${normalizedObjPos.x.toFixed(3)}, y=${normalizedObjPos.y.toFixed(3)}, z=0.760`);
            console.log(`📏 Distance to ${colors[index]} object: ${distance.toFixed(2)} units`);
          });
        }
      };

      const onPointerUp = () => {
        isDragging = false;
      };

      // Add event listeners
      renderer.domElement.addEventListener('mousedown', onPointerDown);
      renderer.domElement.addEventListener('mousemove', onPointerMove);
      renderer.domElement.addEventListener('mouseup', onPointerUp);
      renderer.domElement.addEventListener('touchstart', onPointerDown);
      renderer.domElement.addEventListener('touchmove', onPointerMove);
      renderer.domElement.addEventListener('touchend', onPointerUp);

      const animate = () => {
        if (!isMounted) return;
        
        requestAnimationFrame(animate);
        
        const currentTime = performance.now();
        lastTimeRef.current = currentTime;
        
        // Step Rapier physics simulation with balanced precision (only if not replaying)
        if (worldRef.current && !isReplayingRef.current) {
          // Use normal step rate for good performance and interaction
          worldRef.current.step();
        }
        
        // Handle replay or normal physics
        if (isReplayingRef.current) {
          replayFrame();
        } else {
          // Sync object meshes with their physics bodies (normal mode)
          objects.forEach(obj => {
            const position = obj.body.translation();
            const rotation = obj.body.rotation();
            
            obj.mesh.position.set(position.x, position.y, position.z);
            obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
          });
          
          // Record frame if recording
          recordFrame();
        }
        
        renderer.render(scene, camera);
      };
      
      animate();

      // Cleanup function
      return () => {
        isMounted = false;
        initializedRef.current = false; // Reset for potential remount
        
        // Remove event listeners
        renderer.domElement.removeEventListener('mousedown', onPointerDown);
        renderer.domElement.removeEventListener('mousemove', onPointerMove);
        renderer.domElement.removeEventListener('mouseup', onPointerUp);
        renderer.domElement.removeEventListener('touchstart', onPointerDown);
        renderer.domElement.removeEventListener('touchmove', onPointerMove);
        renderer.domElement.removeEventListener('touchend', onPointerUp);
        
        // Clean up physics bodies
        objects.forEach(obj => {
          if (worldRef.current) {
            worldRef.current.removeRigidBody(obj.body);
          }
        });
        
        if (robotArmRef.current) {
          robotArmRef.current.dispose();
        }
        
        // Clean up renderer
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    };

    initPhysics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onVerify]);

  return (
    <OuterBox>
      <Logo>3D CAPTCHA</Logo>
      <CanvasFrame>
        <div ref={mountRef} />
      </CanvasFrame>
      
      <ApiKeyContainer>
        <ApiKeyLabel htmlFor="gemini-api-key">
          🔑 Gemini API Key (Flash 2.0)
        </ApiKeyLabel>
        <ApiKeyInput
          id="gemini-api-key"
          type="password"
          placeholder="Enter your Gemini API key..."
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            clearVerificationResult();
          }}
          disabled={isRecording || isReplaying || isVerifying}
        />
      </ApiKeyContainer>
      
      <ApiKeyContainer>
        <ApiKeyLabel htmlFor="captcha-task">
          📋 CAPTCHA Task
        </ApiKeyLabel>
        <ApiKeyInput
          id="captcha-task"
          type="text"
          placeholder="e.g., Move the robot arm to touch a red cube"
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            clearVerificationResult();
          }}
          disabled={isRecording || isReplaying || isVerifying}
        />
      </ApiKeyContainer>
      
      <Instructions>
        <strong>Current Task:</strong> {task || 'No task specified'}
        <br />
        <small>Use the mouse to drag the robot arm around the scene.</small>
      </Instructions>
      <ControlsContainer>
        {!isRecording ? (
          <ControlButton 
            $variant="primary" 
            onClick={() => {
              console.log('🔵 Start Recording button clicked!');
              startRecording();
            }}
            disabled={isReplaying}
          >
            🔴 Start Recording
          </ControlButton>
        ) : (
          <ControlButton 
            $variant="danger" 
            onClick={() => {
              console.log('🔵 Stop Recording button clicked!');
              stopRecording();
            }}
          >
            ⏹️ Stop Recording
          </ControlButton>
        )}
        
        {!isReplaying ? (
          <ControlButton 
            onClick={startReplay}
            disabled={!hasRecording || isRecording}
          >
            ▶️ Replay {hasRecording ? '(Ready)' : '(No Data)'}
          </ControlButton>
        ) : (
          <ControlButton 
            $variant="danger" 
            onClick={() => {
              console.log('🔵 Stop Replay button clicked!');
              stopReplay();
              saveCanvasImage();
            }}
          >
            ⏹️ Stop Replay
          </ControlButton>
        )}
        
        <ControlButton
          $variant="primary"
          onClick={() => {
            console.log('🟢 Verify with Gemini button clicked!');
            verifyWithGemini();
          }}
          disabled={isRecording || isReplaying || isVerifying || !apiKey.trim() || !task.trim()}
        >
          {isVerifying ? '🔄 Verifying...' : '✅ Verify with Gemini'}
        </ControlButton>
        
        <ControlButton
          $variant="secondary"
          onClick={() => {
            console.log('📸 Save Screenshot button clicked!');
            saveCanvasImage();
          }}
          disabled={isRecording || isReplaying || isVerifying}
        >
          📸 Save Screenshot
        </ControlButton>
        
        <ControlButton
          $variant="secondary"
          onClick={() => {
            console.log('📊 Save CSV button clicked!');
            saveRecordingAsCSV();
          }}
          disabled={!hasRecording || isRecording || isReplaying || isVerifying}
        >
          📊 Save CSV {hasRecording ? '(Ready)' : '(No Data)'}
        </ControlButton>
        
        {isRecording && <StatusIndicator $isActive={true} />}
        {isReplaying && <span style={{fontSize: '0.8rem', color: '#666'}}>Replaying...</span>}
      </ControlsContainer>
      
      {/* Debug info - remove in production */}
      <div style={{fontSize: '0.7rem', color: '#999', marginTop: '8px', textAlign: 'center'}}>
        Debug: Recording={isRecording ? 'ON' : 'OFF'} | 
        HasData={hasRecording ? 'YES' : 'NO'} | 
        Replaying={isReplaying ? 'ON' : 'OFF'}
      </div>
      
      {verificationResult && (
        <VerificationResult $result={verificationResult}>
          {verificationResult === 'success' ? 'CAPTCHA PASSED!' : 'CAPTCHA FAILED'}
        </VerificationResult>
      )}
    </OuterBox>
  );
};

export default ThreeCaptcha; 