import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import VideoCall from './pages/Videocall.jsx'
import './App.css'

function App() {

  return (
    <>
      <Router>
        <Routes>
          <Route path='/' element={<VideoCall />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
