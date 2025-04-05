import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/UserContext'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage, disconnectSocket } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js'
import { getWebContainer } from '../config/webcontainer'

// This creates a simple HTML file with the right meta tags for CSP
function createIndexHtmlWithCSP(fileTree) {
    if (!fileTree['index.html']) {
      const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval';">
      <title>Express App</title>
  </head>
  <body>
      <div id="root"></div>
      <script src="/main.js"></script>
  </body>
  </html>`;
  
      return {
        ...fileTree,
        'public': {
          directory: {
            ...(fileTree.public?.directory || {}),
            'index.html': {
              file: {
                contents: htmlContent
              }
            }
          }
        }
      };
    }
    return fileTree;
}

// Now modify the mountAndRunProject function to use this:
async function mountAndRunProject() {
    try {
        // Fix file tree structure if needed
        let updatedFileTree = { ...fileTree };
        
        // Check for invalid paths and fix them
        const keys = Object.keys(updatedFileTree);
        for (const key of keys) {
            if (key.includes('/')) {
                const pathParts = key.split('/');
                let currentPath = '';
                let currentObj = updatedFileTree;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    
                    if (!currentObj[part]) {
                        currentObj[part] = { directory: {} };
                    } else if (!currentObj[part].directory) {
                        currentObj[part].directory = {};
                    }
                    
                    currentObj = currentObj[part].directory;
                }
                
                const fileName = pathParts[pathParts.length - 1];
                currentObj[fileName] = {
                    file: {
                        contents: updatedFileTree[key].file.contents
                    }
                };
                delete updatedFileTree[key];
            }
        }
        
        // Add index.html with CSP headers if missing
        updatedFileTree = createIndexHtmlWithCSP(updatedFileTree);
        
        if (JSON.stringify(updatedFileTree) !== JSON.stringify(fileTree)) {
            updateFileTree(updatedFileTree);
        }
        
        await webContainer.mount(updatedFileTree);
        
        if (runProcess) {
            await runProcess.kill();
        }
        
        const installProcess = await webContainer.spawn("npm", ["install"]);
        installProcess.output.pipeTo(new WritableStream({
            write(chunk) {
                console.log("Install output:", chunk);
            }
        }));
        
        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
            throw new Error(`Install failed with exit code ${installExitCode}`);
        }
        
        const tempRunProcess = await webContainer.spawn("npm", ["start"]);
        tempRunProcess.output.pipeTo(new WritableStream({
            write(chunk) {
                console.log("Run output:", chunk);
            }
        }));
        
        setRunProcess(tempRunProcess);
        
        webContainer.on('server-ready', (port, url) => {
            console.log(`Server ready on port ${port} at ${url}`);
            setIframeUrl(url);
            setIsRunning(false);
        });
    } catch (error) {
        console.error("Failed to run project:", error);
        setIsRunning(false);
    }
}

// Custom hook for persisting state in localStorage
const usePersistentState = (key, initialValue) => {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const valueToStore = state instanceof Function ? state(state) : state;
      if (valueToStore !== null && valueToStore !== undefined) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
};

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}

const Project = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useContext(UserContext)
    
    // State management
    const [project, setProject] = useState(location.state?.project || null)
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set())
    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState([])
    
    // Persistent state
    const [persistedProjectId, setPersistedProjectId] = usePersistentState('currentProjectId', null)
    const [persistedFileTree, setPersistedFileTree] = usePersistentState('currentFileTree', {})
    const [persistedOpenFiles, setPersistedOpenFiles] = usePersistentState('currentOpenFiles', [])
    const [persistedCurrentFile, setPersistedCurrentFile] = usePersistentState('currentFile', null)
    
    // Derived state from persistent storage
    const [fileTree, setFileTree] = useState({})
    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])

    // Other state
    const [webContainer, setWebContainer] = useState(null)
    const [iframeUrl, setIframeUrl] = useState(null)
    const [runProcess, setRunProcess] = useState(null)
    const [isRunning, setIsRunning] = useState(false)
    const [users, setUsers] = useState([])
    const [loadingProject, setLoadingProject] = useState(true)
    
    // Refs
    const messageBoxRef = useRef(null)
    const messageInputRef = useRef(null)
    const codeEditorRef = useRef(null)
    
    // Restore project from session storage if page refreshes
    useEffect(() => {
        if (location.state?.project) {
            setProject(location.state.project)
            setPersistedProjectId(location.state.project._id)
        } else if (persistedProjectId && !project) {
            axios.get(`/projects/get-project/${persistedProjectId}`)
                .then(res => {
                    setProject(res.data.project)
                    if (Object.keys(persistedFileTree).length > 0) {
                        setFileTree(persistedFileTree)
                    } else {
                        setFileTree(res.data.project.fileTree || {})
                    }
                    if (persistedOpenFiles.length > 0) {
                        setOpenFiles(persistedOpenFiles)
                        if (persistedCurrentFile && persistedOpenFiles.includes(persistedCurrentFile)) {
                            setCurrentFile(persistedCurrentFile)
                        } else if (persistedOpenFiles.length > 0) {
                            setCurrentFile(persistedOpenFiles[0])
                        }
                    }
                    setLoadingProject(false)
                })
                .catch(err => {
                    console.error("Failed to fetch project:", err)
                    setLoadingProject(false)
                    navigate('/')
                })
        } else if (!project && !persistedProjectId) {
            navigate('/')
        }
    }, [location.state, persistedProjectId, project])

    // Initialize socket and webcontainer
    useEffect(() => {
        if (!project || !project._id) return
        
        setLoadingProject(true)
        
        let messageListener = null
        
        initializeSocket(project._id)
        
        if (!webContainer) {
            getWebContainer()
                .then(container => {
                    setWebContainer(container)
                    console.log("WebContainer started")
                })
                .catch(err => {
                    console.error("Failed to start WebContainer:", err)
                })
        }
        
        messageListener = receiveMessage('project-message', data => {
            console.log("Received message:", data)
            if (data.sender?._id === 'ai') {
                try {
                    const message = JSON.parse(data.message)
                    if (message.fileTree) {
                        updateFileTree(message.fileTree)
                        if (webContainer) {
                            webContainer.mount(message.fileTree).catch(err => {
                                console.error("Failed to mount fileTree:", err)
                            })
                        }
                    }
                    setMessages(prevMessages => [...prevMessages, data])
                    setTimeout(() => {
                        scrollToBottom()
                    }, 100)
                } catch (error) {
                    console.error("Failed to parse AI message:", error)
                }
            } else {
                setMessages(prevMessages => [...prevMessages, data])
                setTimeout(() => {
                    scrollToBottom()
                }, 100)
            }
        })
        
        axios.get(`/projects/get-project/${project._id}`)
            .then(res => {
                setProject(res.data.project)
                const projectFileTree = res.data.project.fileTree || {}
                if (persistedProjectId === project._id && Object.keys(persistedFileTree).length > 0) {
                    setFileTree(persistedFileTree)
                } else {
                    setFileTree(projectFileTree)
                    setPersistedFileTree(projectFileTree)
                }
                setLoadingProject(false)
            })
            .catch(err => {
                console.error("Failed to fetch project:", err)
                setLoadingProject(false)
            })
        
        axios.get('/users/all')
            .then(res => {
                setUsers(res.data.users)
            })
            .catch(err => {
                console.error("Failed to fetch users:", err)
            })
        
        return () => {
            if (messageListener) {
                messageListener()
            }
            disconnectSocket()
            if (runProcess) {
                runProcess.kill()
            }
        }
    }, [project?._id])

    useEffect(() => {
        if (messageInputRef.current) {
            messageInputRef.current.focus()
        }
    }, [messages])
    
    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId)
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id)
            } else {
                newSelectedUserId.add(id)
            }
            return newSelectedUserId
        })
    }

    function addCollaborators() {
        const selectedUsers = Array.from(selectedUserId)
        if (selectedUsers.length === 0) return
        
        axios.put("/projects/add-user", {
            projectId: project._id,
            users: selectedUsers
        }).then(res => {
            setProject(res.data.project)
            setIsModalOpen(false)
        }).catch(err => {
            console.error("Failed to add collaborators:", err)
        })
    }

    const sendMessageHandler = (e) => {
        if (e) {
            e.preventDefault()
        }
        
        if (!message.trim() || !user) return
        
        const newMessage = { 
            sender: user, 
            message: message.trim() 
        }
        setMessages(prevMessages => [...prevMessages, newMessage])
        
        const sentMessage = message.trim()
        setMessage("")
        
        setTimeout(() => {
            sendMessage('project-message', {
                message: sentMessage,
                sender: user
            })
        }, 10)
        
        setTimeout(() => {
            scrollToBottom()
        }, 100)
    }

    function WriteAiMessage(message) {
        if (!message) {
            return <div className="text-red-500">Invalid message data</div>;
        }
        
        try {
            const messageObject = JSON.parse(message);
            return (
                <div className='overflow-auto bg-slate-950 text-white rounded-md p-4 max-w-full'>
                    <Markdown
                        children={messageObject.text || "No content available"}
                        options={{
                            overrides: {
                                code: SyntaxHighlightedCode,
                                pre: {
                                    props: {
                                        className: 'overflow-x-auto max-w-full'
                                    }
                                }
                            },
                        }}
                    />
                </div>
            );
        } catch (error) {
            console.error("Failed to parse AI message:", error);
            return <div className="text-red-500">Error parsing AI response</div>;
        }
    }

    const updateFileTree = (newFileTree) => {
        setFileTree(newFileTree)
        setPersistedFileTree(newFileTree)
        saveFileTree(newFileTree)
    }

    const updateOpenFiles = (files) => {
        setOpenFiles(files)
        setPersistedOpenFiles(files)
    }

    const updateCurrentFile = (file) => {
        setCurrentFile(file)
        setPersistedCurrentFile(file)
    }

    function saveFileTree(ft) {
        if (!project || !project._id) return
        
        return axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        })
        .then(res => {
            console.log("File tree saved successfully")
            return res
        })
        .catch(err => {
            console.error("Failed to save file tree:", err)
            throw err
        })
    }

    function runProject() {
        if (!webContainer || !fileTree || Object.keys(fileTree).length === 0) {
            return
        }
        
        setIsRunning(true)
        
        saveFileTree(fileTree)
            .then(() => mountAndRunProject())
            .catch(error => {
                console.error("Failed to save before running:", error)
                mountAndRunProject()
            })
    }

    async function mountAndRunProject() {
        try {
            await webContainer.mount(fileTree)
            const keys = Object.keys(fileTree)
            const hasRoutesIndexPath = keys.some(key => key === 'routes/index.js')
            
            if (hasRoutesIndexPath) {
                const newFileTree = { ...fileTree }
                if (!newFileTree['routes']) {
                    newFileTree['routes'] = { directory: {} }
                }
                if (newFileTree['routes/index.js']) {
                    newFileTree.routes.directory['index.js'] = {
                        file: {
                            contents: newFileTree['routes/index.js'].file.contents
                        }
                    }
                    delete newFileTree['routes/index.js']
                    updateFileTree(newFileTree)
                    await webContainer.mount(newFileTree)
                }
            }
            
            if (runProcess) {
                await runProcess.kill()
            }
            
            const installProcess = await webContainer.spawn("npm", ["install"])
            installProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    console.log("Install output:", chunk)
                }
            }))
            
            const installExitCode = await installProcess.exit
            if (installExitCode !== 0) {
                throw new Error(`Install failed with exit code ${installExitCode}`)
            }
            
            const tempRunProcess = await webContainer.spawn("npm", ["start"])
            tempRunProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    console.log("Run output:", chunk)
                }
            }))
            
            setRunProcess(tempRunProcess)
            
            webContainer.on('server-ready', (port, url) => {
                console.log(`Server ready on port ${port} at ${url}`)
                setIframeUrl(url)
                setIsRunning(false)
            })
        } catch (error) {
            console.error("Failed to run project:", error)
            setIsRunning(false)
        }
    }

    function scrollToBottom() {
        if (messageBoxRef.current) {
            messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight
        }
    }

    function getFileLanguage(filename) {
        const extension = filename.split('.').pop().toLowerCase()
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'py': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cs': 'csharp',
            'go': 'go',
            'php': 'php',
            'rb': 'ruby'
        }
        
        return languageMap[extension] || 'plaintext'
    }
    
    if (loadingProject) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-100">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading project...</p>
                </div>
            </div>
        )
    }

    return (
        <main className='h-screen w-screen flex overflow-hidden'>
            {/* Left panel - Chat section with fixed width */}
            <section className="left relative flex flex-col h-screen w-96 min-w-96 max-w-md bg-slate-100 border-r border-slate-200">
                <header className='flex justify-between items-center p-3 px-4 w-full bg-white shadow-sm absolute z-10 top-0'>
                    <h1 className="font-semibold text-lg capitalize">{project?.name || 'Project'}</h1>
                    <div className="flex gap-2">
                        <button 
                            className='flex items-center gap-1 py-1 px-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition' 
                            onClick={() => setIsModalOpen(true)}
                        >
                            <i className="ri-user-add-line"></i>
                            <span>Add</span>
                        </button>
                        <button 
                            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} 
                            className='p-1 px-2 text-slate-600 hover:bg-slate-100 rounded transition'
                        >
                            <i className="ri-group-line"></i>
                        </button>
                    </div>
                </header>
                
                <div className="conversation-area pt-14 pb-16 flex-grow flex flex-col h-full relative">
                    <div
                        ref={messageBoxRef}
                        className="message-box p-3 flex-grow flex flex-col gap-3 overflow-auto max-h-full scrollbar-hide"
                    >
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <i className="ri-chat-3-line text-4xl mb-2"></i>
                                <p>No messages yet</p>
                                <p className="text-sm mt-1">Start the conversation or use @ai to get help</p>
                            </div>
                        )}
                        
                        {messages.map((msg, index) => (
                            <div 
                                key={index} 
                                className={`${msg.sender?._id === 'ai' ? 'max-w-sm md:max-w-md lg:max-w-lg' : 'max-w-xs md:max-w-sm'} 
                                          ${msg.sender?._id === user?._id ? 'ml-auto bg-blue-500 text-white' : 'bg-white'} 
                                          message flex flex-col p-3 rounded-lg shadow-sm`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-medium ${msg.sender?._id === user?._id ? 'text-blue-200' : 'text-slate-500'}`}>
                                        {msg.sender?._id === 'ai' ? 'AI Assistant' : (msg.sender?.email || 'Unknown')}
                                    </span>
                                </div>
                                <div className={`text-sm ${msg.sender?._id === user?._id ? 'text-white' : 'text-slate-800'} break-words`}>
                                    {msg.sender?._id === 'ai' ? (
                                        WriteAiMessage(msg.message)
                                    ) : (
                                        <p className="whitespace-pre-wrap">{msg.message}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <form 
                        onSubmit={sendMessageHandler}
                        className="inputField w-full flex absolute bottom-0 p-3 bg-white border-t border-slate-200"
                    >
                        <input
                            ref={messageInputRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                                    e.preventDefault();
                                    sendMessageHandler();
                                }
                            }}
                            className='p-2 px-4 border border-slate-300 rounded-l-lg outline-none flex-grow focus:ring-2 focus:ring-blue-500 focus:border-transparent' 
                            type="text" 
                            placeholder='Type a message (use @ai for AI assistance)' 
                        />
                        <button
                            type="submit"
                            disabled={!message.trim()}
                            className='px-4 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition'
                        >
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </form>
                </div>
                
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-white absolute transition-all duration-300 z-20 shadow-lg
                                ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-3 bg-slate-100 border-b border-slate-200'>
                        <h1 className='font-semibold text-lg'>Collaborators</h1>
                        <button 
                            onClick={() => setIsSidePanelOpen(false)} 
                            className='p-1 hover:bg-slate-200 rounded transition'
                        >
                            <i className="ri-close-line"></i>
                        </button>
                    </header>
                    
                    <div className="users flex flex-col gap-1 p-2">
                        {project?.users?.length > 0 ? (
                            project.users.map(collaborator => (
                                <div key={collaborator._id || 'unknown'} className="user p-2 flex items-center gap-3 rounded-md hover:bg-slate-100">
                                    <div className='w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500'>
                                        {collaborator.email && typeof collaborator.email === 'string' 
                                            ? collaborator.email.charAt(0).toUpperCase() 
                                            : '?'}
                                    </div>
                                    <div>
                                        <h3 className='font-medium text-sm'>{collaborator.email || 'Unknown User'}</h3>
                                        <p className="text-xs text-slate-500">
                                            {collaborator._id === user?._id ? 'You' : 'Collaborator'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-slate-500">
                                No collaborators yet
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Right panel - Code editor */}
            <section className="right bg-slate-50 flex-grow h-full flex">
                <div className="explorer h-full w-64 bg-slate-100 border-r border-slate-200 overflow-y-auto">
                    <div className="p-3 border-b border-slate-200 bg-white">
                        <h2 className="font-medium">Files</h2>
                    </div>
                    
                    <div className="file-tree w-full">
                        {Object.keys(fileTree).length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                <p>No files yet</p>
                                <p className="mt-1">Use @ai in chat to generate files</p>
                            </div>
                        ) : (
                            Object.keys(fileTree).map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        updateCurrentFile(file)
                                        if (!openFiles.includes(file)) {
                                            updateOpenFiles([...openFiles, file])
                                        }
                                    }}
                                    className={`cursor-pointer p-2 px-3 flex items-center text-left w-full
                                              hover:bg-slate-200 ${currentFile === file ? 'bg-slate-200' : ''}`}
                                >
                                    <i className={`ri-file-code-line mr-2 ${currentFile === file ? 'text-blue-500' : 'text-slate-400'}`}></i>
                                    <span className="text-sm truncate">{file}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="code-editor flex flex-col flex-grow h-full">
                    <div className="top flex justify-between w-full bg-white border-b border-slate-200">
                        <div className="files flex overflow-x-auto">
                            {openFiles.length === 0 ? (
                                <div className="p-3 text-slate-500 text-sm">
                                    Select a file to edit
                                </div>
                            ) : (
                                <div className="flex">
                                    {openFiles.map((file, index) => (
                                        <button
                                            key={index}
                                            onClick={() => updateCurrentFile(file)}
                                            className={`tab flex items-center gap-1 p-3 text-sm border-r border-slate-200
                                                      ${currentFile === file ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className="truncate max-w-32">{file}</span>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    const newOpenFiles = openFiles.filter(f => f !== file)
                                                    updateOpenFiles(newOpenFiles)
                                                    if (currentFile === file && newOpenFiles.length > 0) {
                                                        updateCurrentFile(newOpenFiles[0])
                                                    } else if (newOpenFiles.length === 0) {
                                                        updateCurrentFile(null)
                                                    }
                                                }} 
                                                className="ml-1 opacity-50 hover:opacity-100"
                                            >
                                                <i className="ri-close-line"></i>
                                            </button>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="actions flex">
                            <button
                                onClick={runProject}
                                disabled={isRunning || Object.keys(fileTree).length === 0}
                                className="p-2 px-4 m-1 bg-green-500 text-white rounded text-sm flex items-center gap-1 
                                         hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed transition"
                            >
                                {isRunning ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1"></div>
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <i className="ri-play-fill"></i>
                                        Run
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <div className="bottom flex flex-grow max-w-full overflow-auto">
                        {currentFile && fileTree[currentFile] ? (
                            <div className="code-editor-area h-full overflow-auto flex-grow bg-slate-50">
                                <pre className="hljs h-full p-4 m-0">
                                    <code
                                        ref={codeEditorRef}
                                        className={`hljs language-${getFileLanguage(currentFile)} h-full outline-none`}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            if (!currentFile) return
                                            
                                            try {
                                                const updatedContent = e.target.innerText
                                                const updatedFileTree = {
                                                    ...fileTree,
                                                    [currentFile]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }
                                                
                                                updateFileTree(updatedFileTree)
                                                
                                                const saveTimeout = setTimeout(() => {
                                                    saveFileTree(updatedFileTree)
                                                }, 500)
                                                
                                                return () => clearTimeout(saveTimeout)
                                            } catch (error) {
                                                console.error("Error updating file:", error)
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab') {
                                                e.preventDefault()
                                                document.execCommand('insertText', false, '  ')
                                            }
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: hljs.highlight(
                                                getFileLanguage(currentFile), 
                                                fileTree[currentFile].file.contents
                                            ).value
                                        }}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            paddingBottom: '25rem',
                                        }}
                                    />
                                </pre>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-full h-full text-slate-400">
                                <div className="text-center">
                                    <i className="ri-file-code-line text-5xl mb-2"></i>
                                    <p>No file selected</p>
                                    <p className="text-sm mt-1">Select a file from the explorer</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Updated Preview Panel */}
                {iframeUrl && webContainer && (
                    <div className="flex w-1/2 flex-col h-full border-l border-slate-200">
                        <div className="address-bar p-2 bg-white border-b border-slate-200 flex">
                            <input 
                                type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl} 
                                className="w-full p-1 px-2 text-sm bg-slate-100 border border-slate-200 rounded" 
                            />
                            <button 
                                onClick={() => {
                                    // Refresh iframe
                                    const iframe = document.querySelector('iframe');
                                    if (iframe) {
                                        iframe.src = iframeUrl;
                                    }
                                }}
                                className="ml-2 p-1 px-2 bg-slate-100 rounded hover:bg-slate-200"
                            >
                                <i className="ri-refresh-line"></i>
                            </button>
                        </div>
                        <iframe 
                            src={iframeUrl} 
                            className="w-full h-full bg-white" 
                            title="Preview"
                            sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-downloads"
                            allow="accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi"
                        ></iframe>
                    </div>
                )}
            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Add Collaborators</h2>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className='p-1 hover:bg-slate-100 rounded transition'
                            >
                                <i className="ri-close-line"></i>
                            </button>
                        </header>
                        
                        {users.length === 0 ? (
                            <div className="text-center py-4 text-slate-500">
                                <p>No users available</p>
                            </div>
                        ) : (
                            <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-y-auto">
                                {users.map(user => {
                                    const isCollaborator = project?.users?.some(
                                        collaborator => collaborator._id === user._id
                                    )
                                    
                                    return (
                                        <div 
                                            key={user._id || 'unknown'} 
                                            className={`user cursor-pointer p-2 rounded-md flex gap-3 items-center
                                                      ${isCollaborator ? 'bg-blue-50 text-blue-700' : 
                                                        selectedUserId.has(user._id) ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                                            onClick={() => {
                                                if (!isCollaborator) {
                                                    handleUserClick(user._id)
                                                }
                                            }}
                                        >
                                            <div className='w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500'>
                                                {user.email && typeof user.email === 'string' 
                                                    ? user.email.charAt(0).toUpperCase() 
                                                    : '?'}
                                            </div>
                                            <div className="flex-grow">
                                                <h3 className='font-medium text-sm'>{user.email || 'Unknown User'}</h3>
                                                <p className="text-xs text-slate-500">
                                                    {isCollaborator ? 'Already added' : 'Click to select'}
                                                </p>
                                            </div>
                                            {selectedUserId.has(user._id) && !isCollaborator && (
                                                <i className="ri-check-line text-green-500"></i>
                                            )}
                                            {isCollaborator && (
                                                <i className="ri-user-check-line text-blue-500"></i>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        
                        <div className="flex justify-end absolute bottom-6 right-6 left-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-md mr-2 hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addCollaborators}
                                disabled={selectedUserId.size === 0}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                                         disabled:bg-blue-300 disabled:cursor-not-allowed transition"
                            >
                                Add Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project
