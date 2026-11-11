import React from 'react'
import {Navbar} from './components/Navbar'
import { Outlet } from 'react-router-dom'

const Layout = ({email, nickname}) => {

  return (
    <div>
    <Navbar user_nickname={nickname} />
    <main>
        <Outlet context={email}/>
    </main>
    </div>
  )
}

export { Layout }