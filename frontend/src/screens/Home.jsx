import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/UserContext'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {
    const { user } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [projectName, setProjectName] = useState("")
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const navigate = useNavigate()

    // Function to handle Enter key press in the modal
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && projectName.trim()) {
            createProject(e)
        }
    }

    // Function to create a new project
    function createProject(e) {
        e.preventDefault()
        if (!projectName.trim()) return

        setLoading(true)
        axios.post('/projects/create', { name: projectName })
            .then((res) => {
                // Add the new project to the projects list
                setProjects(prevProjects => [...prevProjects, res.data])
                setProjectName("")
                setIsModalOpen(false)
                setLoading(false)
            })
            .catch((error) => {
                console.error(error)
                setError(error.response?.data?.message || "Failed to create project")
                setLoading(false)
            })
    }

    // Fetch all projects on component mount
    useEffect(() => {
        setLoading(true)
        axios.get('/projects/all')
            .then((res) => {
                setProjects(res.data.projects)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setError("Failed to load projects")
                setLoading(false)
            })
    }, [])

    return (
        <main className='p-6 min-h-screen bg-gray-50'>
            <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Your Projects</h1>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                <div className="projects grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="project flex items-center justify-center h-40 border-2 border-dashed border-slate-300 rounded-md hover:bg-slate-100 transition duration-200">
                        <div className="text-center">
                            <i className="ri-add-line text-3xl text-slate-500 mb-2"></i>
                            <p className="text-slate-500">Create New Project</p>
                        </div>
                    </button>

                    {loading && !projects.length ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="bg-white p-4 border border-slate-200 rounded-md shadow-sm animate-pulse h-40">
                                <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
                                <div className="h-3 bg-slate-200 rounded mb-2 w-1/2"></div>
                                <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                            </div>
                        ))
                    ) : (
                        projects.map((project) => (
                            <div key={project._id}
                                onClick={() => {
                                    navigate(`/project`, {
                                        state: { project }
                                    })
                                }}
                                className="project flex flex-col justify-between bg-white p-4 border border-slate-200 rounded-md shadow-sm h-40 cursor-pointer hover:shadow-md transition duration-200">
                                <h2 className='font-semibold text-lg capitalize'>{project.name}</h2>
                                <div className="mt-auto">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <i className="ri-user-line"></i>
                                        <p>{project.users?.length || 1} Collaborator{project.users?.length !== 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        Last edited: {new Date().toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
                        <form onSubmit={createProject}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                <input
                                    autoFocus
                                    onChange={(e) => setProjectName(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    value={projectName}
                                    type="text" 
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                    required 
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button 
                                    type="button" 
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition"
                                    disabled={!projectName.trim() || loading}
                                >
                                    {loading ? 'Creating...' : 'Create Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Home