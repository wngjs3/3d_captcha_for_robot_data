# 🤖 3D CAPTCHA for Robot Data Collection

An interactive 3D CAPTCHA system designed for collecting robot manipulation data. This project provides a web-based interface where users control a robot arm to interact with colored objects, generating valuable datasets for robotics research.

## 🌐 Live Demo

**[👉 Try it now](https://wngjs3.github.io/3d_captcha_for_robot_data)**

## ✨ Features

### 🎮 Interactive 3D Environment
- **Real-time robot arm control** via mouse/touch
- **Physics simulation** using Rapier.js engine
- **Realistic object interactions** with gravity and collision detection

### 📊 Data Collection System
- **10fps precision recording** (100ms intervals)
- **Normalized coordinate system** for consistent data analysis
- **CSV export** with standardized format
- **Real-time coordinate display** during interaction

### 🎯 CAPTCHA Integration
- **AI-powered verification** using Google Gemini Flash 2.0
- **Task-based challenges** (e.g., "Move robot arm to touch red cube")
- **Automated success detection** through vision analysis

### 🎬 Replay System
- **Accurate playback** of recorded sessions
- **Frame-perfect reproduction** of robot arm movements
- **Visual debugging** for data validation

## 🏗️ Technical Specifications

### Object Configuration
- **Robot Arm**: 3cm diameter cylinder, fixed starting position (0, 0.4, 0)
- **Objects**: 3 fixed-color cubes (Red, Green, Blue)
  - Size: 2.5cm × 2.5cm × 2.5cm
  - Real-world scale: 20cm × 20cm table
- **Physics**: Anti-collision placement, realistic gravity simulation

### Data Format
```csv
Timestamp,RobotArm_X,RobotArm_Y,RobotArm_Z,Object1_Pos_X,Object1_Pos_Y,Object1_Pos_Z,Object1_Rot_X,Object1_Rot_Y,Object1_Rot_Z,Object1_Rot_W,...
0.000,0.300,0.000,0.760,0.250,-0.100,0.760,0.000,0.000,0.000,1.000,...
100.000,0.320,0.050,0.760,0.250,-0.100,0.760,0.010,0.005,0.000,0.999,...
```

### Coordinate System
- **X-axis**: 0.2 → 0.40 (back to front, 20cm range)
- **Y-axis**: -0.20 → 0.20 (left to right, 40cm range)  
- **Z-axis**: 0.76 (fixed height for 2D analysis)
- **Frame Rate**: 10 Hz (100ms intervals)

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with WebGL support
- Google Gemini API key (for CAPTCHA verification)

### Installation

```bash
# Clone the repository
git clone https://github.com/wngjs3/3d_captcha_for_robot_data.git
cd 3d_captcha_for_robot_data

# Install dependencies
npm install

# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view in browser.

### Production Build

```bash
# Build for production
npm run build

# Serve static files
npx serve -s build
```

## 📖 Usage Guide

### 1. Basic Operation
1. **Mouse Control**: Click and drag to move the robot arm
2. **Recording**: Click "🔴 Start Recording" to begin data collection
3. **Interaction**: Move robot arm to touch colored objects
4. **Stop**: Click "⏹️ Stop Recording" when task is complete

### 2. Data Export
1. Complete a recording session
2. Click "📊 Save CSV" to download data
3. Open CSV file in spreadsheet software or data analysis tools

### 3. CAPTCHA Verification
1. Enter your Gemini API key
2. Specify task (e.g., "Touch the red cube")
3. Complete the interaction
4. Click "✅ Verify with Gemini" for AI validation

### 4. Replay Analysis
1. After recording, click "▶️ Replay"
2. Watch frame-by-frame reproduction
3. Validate data accuracy visually

## 🛠️ Technical Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Styled Components** - CSS-in-JS styling

### 3D Graphics & Physics
- **Three.js** - 3D rendering engine
- **Rapier.js** - Physics simulation
- **WebGL** - Hardware-accelerated graphics

### AI Integration
- **Google Gemini Flash 2.0** - Vision-language model
- **Base64 image encoding** - Screenshot analysis
- **REST API** - Real-time verification

### Development & Deployment
- **GitHub Actions** - Automated CI/CD
- **GitHub Pages** - Static site hosting
- **ESLint** - Code quality

## 📊 Data Analysis Example

```python
import pandas as pd
import numpy as np

# Load recorded data
data = pd.read_csv('captcha-recording-[timestamp].csv')

# Calculate robot arm trajectory
robot_positions = data[['RobotArm_X', 'RobotArm_Y']].values
trajectory_length = np.sum(np.linalg.norm(np.diff(robot_positions, axis=0), axis=1))

# Analyze object interactions
red_cube = data[['Object1_Pos_X', 'Object1_Pos_Y']].values
distances = np.linalg.norm(robot_positions - red_cube, axis=1)
min_distance = np.min(distances)

print(f"Trajectory length: {trajectory_length:.3f}")
print(f"Closest approach to red cube: {min_distance:.3f}")
```

## 🔬 Research Applications

### Robotics
- **Motion planning algorithms** validation
- **Human-robot interaction** studies
- **Manipulation strategy** analysis

### Machine Learning
- **Imitation learning** datasets
- **Reinforcement learning** environments
- **Vision-based control** training data

### Human Factors
- **User interface** design research
- **Task completion** analysis
- **Interaction pattern** studies

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Three.js** community for excellent 3D web graphics
- **Rapier.js** for high-performance physics simulation
- **Google Gemini** for advanced AI capabilities
- **React** team for robust frontend framework

## 📧 Contact

- **Repository**: [wngjs3/3d_captcha_for_robot_data](https://github.com/wngjs3/3d_captcha_for_robot_data)
- **Issues**: [Report bugs or request features](https://github.com/wngjs3/3d_captcha_for_robot_data/issues)

---

**Made with ❤️ for the robotics research community** 