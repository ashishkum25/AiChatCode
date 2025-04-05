import React, { useState, useContext, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/UserContext'

const Register = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { user, setUser } = useContext(UserContext)
    const navigate = useNavigate()

    // If user is already logged in, redirect to home
    useEffect(() => {
        if (user) {
            navigate('/')
        }
    }, [user, navigate])

    function submitHandler(e) {
        e.preventDefault()
        setError('')

        // Validate password match
        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        // Validate email format
        if (!email.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i)) {
            setError('Please enter a valid email address')
            return
        }

        // Validate minimum length for email
        if (email.length < 14) {
            setError('Email must be at least 14 characters')
            return
        }

        // Validate password length
        if (password.length < 5) {
            setError('Password must be at least 5 characters')
            return
        }

        setLoading(true)

        axios.post('/users/register', {
            email,
            password
        }).then((res) => {
            localStorage.setItem('token', res.data.token)
            setUser(res.data.user)
            navigate('/')
        }).catch((err) => {
            setLoading(false)
            setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed')
        })
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-white mb-6">Create an Account</h2>
                
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
                        <p className="text-gray-500 text-xs mt-1">Must be at least 14 characters</p>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-400 mb-2" htmlFor="password">Password</label>
                        <input
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            id="password"
                            value={password}
                            className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your password"
                            required
                        />
                        <p className="text-gray-500 text-xs mt-1">Must be at least 5 characters</p>
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2" htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Confirm your password"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !email || !password || !confirmPassword}
                        className="w-full p-3 rounded bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition"
                    >
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
                <p className="text-gray-400 mt-4">
                    Already have an account? <Link to="/login" className="text-blue-500 hover:underline">Login</Link>
                </p>
            </div>
        </div>
    )
}

export default Register