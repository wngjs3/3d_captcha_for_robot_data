import React, { useState } from 'react';
import styled from 'styled-components';
import ThreeCaptcha from './components/Captcha/ThreeCaptcha';

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
`;

const Message = styled.div`
  margin-top: 24px;
  font-size: 1.2rem;
  color: #388e3c;
  font-weight: bold;
`;

const App: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);

  const handleVerification = (verified: boolean) => {
    setIsVerified(verified);
  };

  return (
    <AppContainer>
      <ThreeCaptcha onVerify={handleVerification} />
      {isVerified && <Message>CAPTCHA 통과! (You are not a robot)</Message>}
    </AppContainer>
  );
};

export default App; 