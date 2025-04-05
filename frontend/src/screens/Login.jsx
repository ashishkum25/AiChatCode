import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/UserContext'

const Login = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { user, setUser } = useContext(UserContext)
    const navigate = useNavigate()

    // If user is already logged in, redirect to home or previous page
    useEffect(() => {
        if (user) {
            // Check if there's a redirect path stored
            const redirectPath = sessionStorage.getItem('redirectPath')
            if (redirectPath) {
                sessionStorage.removeItem('redirectPath')
                navigate(redirectPath)
            } else {
                navigate('/')
            }
        }
    }, [user, navigate])

    function submitHandler(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        axios.post('/users/login', {
            email,
            password
        }).then((res) => {
            // Store token in localStorage
            localStorage.setItem('token', res.data.token)
            
            // Update user context
            setUser(res.data.user)
            
            // Redirect after successful login
            const redirectPath = sessionStorage.getItem('redirectPath')
            if (redirectPath) {
                sessionStorage.removeItem('redirectPath')
                navigate(redirectPath)
            } else {
                navigate('/')
            }
        }).catch((err) => {
            setLoading(false)
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.')
        })
    }

    // Handle Enter key in password field (already handled by form submit)
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && email && password) {
            submitHandler(e)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-white mb-6">Login to Your Account</h2>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded-md text-sm">
                        {error}
                    </div>
                )}
                
                <form onSubmit={submitHandler}>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="email">Email</label>
                        <input
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            id="email"
                            value={email}
                            autoFocus
                            className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your email"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2" htmlFor="password">Password</label>
                        <input
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={handleKeyPress}
                            type="password"
                            id="password"
                            value={password}
                            className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your password"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="w-full p-3 rounded bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <p className="text-gray-400 mt-4">
                    Don't have an account? <Link to="/register" className="text-blue-500 hover:underline">Create one</Link>
                </p>
            </div>
        </div>
    )
}

export default Login