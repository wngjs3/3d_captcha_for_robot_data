import React, { useRef, useEffect, useState, useCallback } from 'react';
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
    this.radius = 0.3;
    
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

const ThreeCaptcha: React.FC<ThreeCaptchaProps> = ({ onVerify }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const robotArmRef = useRef<RobotArm | null>(null);
  const objectsRef = useRef<Array<{ mesh: THREE.Mesh, body: RAPIER.RigidBody }>>([]);
  const lastTimeRef = useRef<number>(0);
  const worldRef = useRef<RAPIER.World | null>(null);
  const initializedRef = useRef<boolean>(false);

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
      const renderer = new THREE.WebGLRenderer({ antialias: true });
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
      
      // Define colors for objects
      const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff];
      
      // Create 3-5 random objects (restored for better interaction)
      const numObjects = 3 + Math.floor(Math.random() * 3); // 3-5 objects
      
      // Function to check if a position is too close to existing objects
      const isPositionValid = (x: number, z: number, radius: number): boolean => {
        const minDistance = radius * 4; // Reduced from 8 to allow more interaction
        
        for (const pos of occupiedPositions) {
          const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(z - pos.z, 2));
          if (distance < minDistance + pos.radius * 2) { // Reduced safety margin
            return false;
          }
        }
        return true;
      };
      
      for (let i = 0; i < numObjects; i++) {
        const isBox = Math.random() > 0.5; // 50% chance for box or cylinder
        let geometry: THREE.BufferGeometry;
        let colliderDesc: RAPIER.ColliderDesc;
        let objectRadius: number;
        
        if (isBox) {
          // Create reasonably sized cubes for good interaction
          const size = 0.2 + Math.random() * 0.25; // Size between 0.2 and 0.45 (moderate size)
          geometry = new THREE.BoxGeometry(size, size, size);
          colliderDesc = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
          objectRadius = size * 1.2; // Reasonable safety radius
        } else {
          // Create reasonably sized cylinders
          const radius = 0.1 + Math.random() * 0.15; // Radius between 0.1 and 0.25 (moderate size)
          const height = 0.25 + Math.random() * 0.35; // Height between 0.25 and 0.6 (moderate size)
          geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
          colliderDesc = RAPIER.ColliderDesc.cylinder(height/2, radius);
          objectRadius = radius * 1.5; // Reasonable safety radius
        }
        
        // Create visual mesh
        const material = new THREE.MeshPhongMaterial({ 
          color: colors[i % colors.length],
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
      let dragOffset = new THREE.Vector3();

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
          
          // Log robot arm position for debugging
          console.log(`🤖 Robot arm position: x=${intersection.x.toFixed(2)}, y=${ROBOT_ARM_Y.toFixed(2)}, z=${intersection.z.toFixed(2)}`);
          
          // Log distances to objects for debugging (removed verification trigger)
          objects.forEach((obj, index) => {
            const objPos = obj.mesh.position;
            const distance = Math.sqrt(
              Math.pow(intersection.x - objPos.x, 2) +
              Math.pow(intersection.z - objPos.z, 2)
            );
            console.log(`📏 Distance to object ${index}: ${distance.toFixed(2)} units`);
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
        const deltaTime = (currentTime - lastTimeRef.current) / 1000;
        lastTimeRef.current = currentTime;
        
        // Step Rapier physics simulation with balanced precision
        if (worldRef.current) {
          // Use normal step rate for good performance and interaction
          worldRef.current.step();
        }
        
        // Sync object meshes with their physics bodies
        objects.forEach(obj => {
          const position = obj.body.translation();
          const rotation = obj.body.rotation();
          
          obj.mesh.position.set(position.x, position.y, position.z);
          obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        });
        
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
  }, [onVerify]);

  return (
    <OuterBox>
      <Logo>3D CAPTCHA</Logo>
      <CanvasFrame>
        <div ref={mountRef} />
      </CanvasFrame>
      <Instructions>
        Move the robot arm to touch any of the 3D objects to verify you're human.
      </Instructions>
    </OuterBox>
  );
};

export default ThreeCaptcha; 