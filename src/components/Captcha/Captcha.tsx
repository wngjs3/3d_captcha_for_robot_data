import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

interface CaptchaProps {
  onVerify: (isVerified: boolean) => void;
}

const CaptchaContainer = styled.div`
  width: 300px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  cursor: pointer;
`;

const Checkbox = styled.input`
  margin-right: 10px;
`;

const CaptchaFrame = styled.div`
  width: 100%;
  height: 200px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  background: #f8f8f8;
`;

const IconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 10px;
  width: 100%;
`;

const IconItem = styled.div`
  width: 100%;
  aspect-ratio: 1;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f0f0f0;
  }

  &.selected {
    background: #e3f2fd;
    border-color: #2196f3;
  }
`;

const CaptchaImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Captcha: React.FC<CaptchaProps> = ({ onVerify }) => {
  const [isChecked, setIsChecked] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedIcons, setSelectedIcons] = useState<number[]>([]);

  // Sample icons (using emoji for demonstration)
  const icons = ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒'];

  // Sample images for demonstration
  const sampleImages = [
    'https://picsum.photos/300/200',
    'https://picsum.photos/300/201',
    'https://picsum.photos/300/202',
  ];

  useEffect(() => {
    if (isChecked) {
      setShowImage(true);
      // Randomly select an image
      const randomIndex = Math.floor(Math.random() * sampleImages.length);
      setImageUrl(sampleImages[randomIndex]);
    } else {
      setShowImage(false);
      setSelectedIcons([]);
    }
  }, [isChecked]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsChecked(e.target.checked);
    if (!e.target.checked) {
      onVerify(false);
    }
  };

  const handleIconClick = (index: number) => {
    if (!isChecked) return;
    
    setSelectedIcons(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  return (
    <CaptchaContainer>
      <CheckboxContainer>
        <Checkbox
          type="checkbox"
          checked={isChecked}
          onChange={handleCheckboxChange}
        />
        <span>I'm not a robot</span>
      </CheckboxContainer>
      
      <CaptchaFrame>
        {!showImage ? (
          <IconGrid>
            {icons.map((icon, index) => (
              <IconItem
                key={index}
                className={selectedIcons.includes(index) ? 'selected' : ''}
                onClick={() => handleIconClick(index)}
              >
                {icon}
              </IconItem>
            ))}
          </IconGrid>
        ) : (
          <CaptchaImage src={imageUrl} alt="CAPTCHA" />
        )}
      </CaptchaFrame>
    </CaptchaContainer>
  );
};

export default Captcha; 