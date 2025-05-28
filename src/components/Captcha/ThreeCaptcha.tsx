import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
// Needed for type narrowing inside traverse

interface ThreeCaptchaProps {
  onVerify: (isVerified: boolean) => void;
}

const ROBOT_ARM_Y = 0.3;

// Robot arm class for physics simulation
class RobotArm {
  cylinder: THREE.Mesh;
  body: CANNON.Body;
  position: THREE.Vector3;
  radius: number;
  world: CANNON.World;

  constructor(world: CANNON.World) {
    this.world = world;
    this.radius = 0.3;
    
    // Create visual cylinder
    const geometry = new THREE.CylinderGeometry(this.radius, this.radius, 0.8, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
    this.cylinder = new THREE.Mesh(geometry, material);
    this.cylinder.position.set(0, 0.4, 0);
    
    // Create physics body — use a sphere so it can collide with Trimesh
    const shape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({ mass: 0 }); // Static body (mass = 0) that we move manually
    this.body.addShape(shape);
    this.body.position.set(0, 0.4, 0);
    
    // Add physics material
    this.body.material = new CANNON.Material({
      friction: 0.8,
      restitution: 0.1
    });
    
    world.addBody(this.body);
    
    this.position = this.cylinder.position;
  }

  setPosition(position: THREE.Vector3) {
    this.position.copy(position);
    this.cylinder.position.copy(position);
    this.body.position.set(position.x, position.y, position.z);
  }

  dispose() {
    this.world.removeBody(this.body);
  }
}

const OuterBox = styled.div`
  width: 360px;
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
  width: 300px;
  height: 300px;
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
  const bananaMeshRef = useRef<THREE.Object3D | null>(null);
  const bananaBodyRef = useRef<CANNON.Body | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;
    
    // Create physics world
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0); // Earth gravity
    world.broadphase = new CANNON.NaiveBroadphase();
    
    // Create ground physics body
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 }); // Static body
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    const camera = new THREE.PerspectiveCamera(75, 300 / 300, 0.1, 1000);
    camera.position.set(0, 8, 8);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(300, 300);
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

    // Create robot arm
    const robotArm = new RobotArm(world);
    scene.add(robotArm.cylinder);
    robotArmRef.current = robotArm;

    // Banana configuration - single source of truth
    const BANANA_START_POSITION = { x: 5.0, y: 2.0, z: 5 }; // 테이블 한쪽 모서리
    const BANANA_SCALE = 20;

    /**
     * Convert a THREE.BufferGeometry (or group of them) into a CANNON.Trimesh.
     * This gives a near‑perfect collision surface for complex meshes like a banana.
     *
     * WARNING: Trimesh is computationally heavier than primitive shapes.
     * For a small object it is fine, but avoid for very high‑poly assets.
     */
    function threeMeshToTrimesh(mesh: THREE.Mesh): CANNON.Trimesh {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const positionAttr = geometry.getAttribute('position');
      const indexAttr = geometry.index;

      const vertices: number[] = [];
      const indices: number[] = [];

      const tempVec = new THREE.Vector3();
      const worldMatrix = mesh.matrixWorld;

      // Gather vertices in world space
      for (let i = 0; i < positionAttr.count; i++) {
        tempVec.fromBufferAttribute(positionAttr, i);
        tempVec.applyMatrix4(worldMatrix);
        vertices.push(tempVec.x, tempVec.y, tempVec.z);
      }

      // Gather indices (or generate if none)
      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i++) {
          indices.push(indexAttr.getX(i));
        }
      } else {
        // Non‑indexed geometry – use sequential indices
        for (let i = 0; i < positionAttr.count; i++) {
          indices.push(i);
        }
      }

      // cannon‑es type declarations expect plain number[] for both parameters
      return new CANNON.Trimesh(vertices, indices);
    }

    function setupBananaPhysics(root: THREE.Object3D) {
      // Create a dynamic body that will carry our Trimesh
      const body = new CANNON.Body({ mass: 1 });
      
      // Traverse all child meshes and add their Trimeshes as *compound* shapes
      root.updateWorldMatrix(true, true);
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const tri = threeMeshToTrimesh(mesh);
          
          // Offset: we want vertices relative to root's position
          const offset = new CANNON.Vec3(
            mesh.position.x,
            mesh.position.y,
            mesh.position.z
          );
          body.addShape(tri, offset);
        }
      });

      // Position the body at the same place as the visual root object
      body.position.set(root.position.x, root.position.y, root.position.z);

      world.addBody(body);
      bananaBodyRef.current = body;
      
      console.log('🍌 Added banana Trimesh to physics with', body.shapes.length, 'sub‑shapes');
    }

    // ----- Load banana model -----
    const mtlLoader = new MTLLoader();
    // Use PUBLIC_URL for better compatibility
    mtlLoader.setPath(`${process.env.PUBLIC_URL}/assets/`);
    mtlLoader.load(
      'Banana.mtl',
      (materials) => {
        console.log('✅ MTL loaded successfully', materials);
        materials.preload();
        
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath(`${process.env.PUBLIC_URL}/assets/`);
        objLoader.load(
          'Banana.obj',
          (object) => {
            console.log('✅ OBJ loaded successfully', object);
            
            // Check bounding box before scaling
            const box = new THREE.Box3().setFromObject(object);
            console.log('Original banana AABB:', box);
            console.log('Original banana position:', object.position);
            
            // Try larger scale and position on table surface
            object.scale.set(BANANA_SCALE, BANANA_SCALE, BANANA_SCALE);
            
            // Check bounding box after scaling
            const boxAfter = new THREE.Box3().setFromObject(object);
            console.log('Scaled banana AABB:', boxAfter);
            
            // Apply bright yellow material
            object.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = new THREE.MeshPhongMaterial({ 
                  color: 0xffff00 
                });
              }
            });
            
            scene.add(object);
            bananaMeshRef.current = object;

            setupBananaPhysics(object);
          },
          (progress) => {
            console.log('OBJ loading progress:', progress);
          },
          (err) => {
            console.error('❌ OBJ load error:', err);
            // Fallback: create a simple yellow sphere if OBJ fails
            console.log('Creating fallback yellow sphere...');
            const fallbackGeometry = new THREE.SphereGeometry(1.0, 16, 16); // Larger sphere
            const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
            const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            scene.add(fallbackMesh);
            bananaMeshRef.current = fallbackMesh;
            
            setupBananaPhysics(fallbackMesh);
          }
        );
      },
      (progress) => {
        console.log('MTL loading progress:', progress);
      },
      (err) => {
        console.error('❌ MTL load error:', err);
        // If MTL fails, try loading OBJ without materials
        console.log('Trying to load OBJ without MTL...');
        const objLoader = new OBJLoader();
        objLoader.setPath(`${process.env.PUBLIC_URL}/assets/`);
        objLoader.load(
          'Banana.obj',
          (object) => {
            console.log('✅ OBJ loaded without MTL', object);
            
            object.scale.set(BANANA_SCALE, BANANA_SCALE, BANANA_SCALE);
            
            // Apply bright yellow material
            object.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = new THREE.MeshPhongMaterial({ 
                  color: 0xffff00 
                });
              }
            });
            
            scene.add(object);
            bananaMeshRef.current = object;

            setupBananaPhysics(object);
          },
          undefined,
          (objErr) => {
            console.error('❌ OBJ load error (no MTL):', objErr);
            // Final fallback
            console.log('Creating final fallback sphere...');
            const fallbackGeometry = new THREE.SphereGeometry(1.0, 16, 16); // Larger sphere
            const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Red for error
            const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            scene.add(fallbackMesh);
            bananaMeshRef.current = fallbackMesh;
            
            setupBananaPhysics(fallbackMesh);
          }
        );
      }
    );

    // Drag logic for robot arm
    let isDragging = false;
    let dragOffset = new THREE.Vector3();

    function getPointerPosition(event: MouseEvent | TouchEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      let clientX: number, clientY: number;
      
      if ('touches' in event) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      return new THREE.Vector2(x, y);
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      event.preventDefault();
      if (!robotArmRef.current) return;
      const { x, y } = getPointerPosition(event);
      const pointer = new THREE.Vector2(x, y);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(robotArmRef.current.cylinder, true);
      if (intersects.length > 0) {
        isDragging = true;
        dragOffset.copy(intersects[0].point).sub(robotArmRef.current.position);
      }
    }

    function onPointerMove(event: MouseEvent | TouchEvent) {
      if (!isDragging || !robotArmRef.current) return;
      
      const pointer = getPointerPosition(event);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      
      // Create a plane at ground level for intersection
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersection);
      
      if (intersection) {
        // Keep robot arm at proper height
        intersection.y = 0.4;
        robotArmRef.current.setPosition(intersection);
        
        // Log robot arm position for debugging
        console.log(`🤖 Robot arm position: x=${intersection.x.toFixed(2)}, y=${intersection.y.toFixed(2)}, z=${intersection.z.toFixed(2)}`);
        
        // Also log banana position if it exists
        if (bananaMeshRef.current) {
          const bananaPos = bananaMeshRef.current.position;
          console.log(`🍌 Banana position: x=${bananaPos.x.toFixed(2)}, y=${bananaPos.y.toFixed(2)}, z=${bananaPos.z.toFixed(2)}`);
          
          // Calculate distance between robot arm and banana
          const distance = Math.sqrt(
            Math.pow(intersection.x - bananaPos.x, 2) + 
            Math.pow(intersection.z - bananaPos.z, 2)
          );
          console.log(`📏 Distance between robot arm and banana: ${distance.toFixed(2)} units`);
        }
      }
    }

    function onPointerUp() {
      isDragging = false;
    }

    renderer.domElement.addEventListener('mousedown', onPointerDown);
    renderer.domElement.addEventListener('mousemove', onPointerMove);
    renderer.domElement.addEventListener('mouseup', onPointerUp);
    renderer.domElement.addEventListener('touchstart', onPointerDown);
    renderer.domElement.addEventListener('touchmove', onPointerMove);
    renderer.domElement.addEventListener('touchend', onPointerUp);

    // Animation loop
    function animate() {
      if (!isMounted) return;
      
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      // Step physics simulation
      world.step(1/60, deltaTime, 3);
      // Sync banana mesh with its physics body
      if (bananaMeshRef.current && bananaBodyRef.current) {
        bananaMeshRef.current.position.set(
          bananaBodyRef.current.position.x,
          bananaBodyRef.current.position.y,
          bananaBodyRef.current.position.z
        );
        bananaMeshRef.current.quaternion.set(
          bananaBodyRef.current.quaternion.x,
          bananaBodyRef.current.quaternion.y,
          bananaBodyRef.current.quaternion.z,
          bananaBodyRef.current.quaternion.w
        );
      }
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    
    lastTimeRef.current = performance.now();
    animate();

    return () => {
      isMounted = false;
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      if (bananaBodyRef.current) {
        world.removeBody(bananaBodyRef.current);
      }
    };
  }, [onVerify]);

  return (
    <OuterBox>
      <Logo>3D CAPTCHA</Logo>
      <CanvasFrame>
        <div
          ref={mountRef}
          style={{ width: 300, height: 300 }}
        />
      </CanvasFrame>
      <Instructions>
        Drag the robot arm around the table.
      </Instructions>
    </OuterBox>
  );
};

export default ThreeCaptcha; 