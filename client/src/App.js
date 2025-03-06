
import './App.css';
import { Routes, Route } from 'react-router-dom';
import LobbyScreen from './screens/LobbyScreen.jsx'
import RoomPage from './screens/RoomPage.jsx';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path='/' element={<LobbyScreen/>}></Route>
        <Route path='/room/:roomId' element={<RoomPage/>}></Route>
      </Routes>
    </div>
  );
}

export default App;
