import React, { useContext, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { UserContext } from '../context/UserContext'

const UserAuth = ({ children }) => {
    const { user, loading } = useContext(UserContext)
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        // Only check after loading is done
        if (!loading) {
            const token = localStorage.getItem('token')
            
            // If no token or no user, redirect to login
            if (!token || !user) {
                // Save the current location for redirect after login
                const currentPath = location.pathname + location.search + location.hash
                if (currentPath !== '/login') {
                    // Store the path user was trying to access
                    sessionStorage.setItem('redirectPath', currentPath)
                    navigate('/login')
                }
            }
        }
    }, [loading, user, navigate, location]);

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    // If authenticated, render children
    return user ? <>{children}</> : null
}

export default UserAuth