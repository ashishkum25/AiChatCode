import React, { createContext, useState, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    // Initialize user state from localStorage if available
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [loading, setLoading] = useState(true);

    // Initial check for user authentication on component mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        
        // If no token, no need to verify
        if (!token) {
            setLoading(false);
            return;
        }
        
        // If we have a token but no user, fetch user data
        if (token && !user) {
            axios.get('/users/profile')
                .then(res => {
                    setUser(res.data.user);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                })
                .catch(err => {
                    console.error("Failed to get user profile:", err);
                    // If invalid token, clear it
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    // Save user to localStorage whenever it changes
    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    // Custom function to handle logout
    const logout = () => {
        // Call logout API if needed
        if (localStorage.getItem('token')) {
            axios.get('/users/logout')
                .then(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                })
                .catch(err => {
                    console.error("Logout failed:", err);
                    // Clear storage anyway
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                });
        }
    };

    return (
        <UserContext.Provider value={{ user, setUser, loading, logout }}>
            {children}
        </UserContext.Provider>
    );
};