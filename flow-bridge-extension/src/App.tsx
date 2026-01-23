import { ClerkProvider, useAuth, useUser, SignInButton, useClerk } from '@clerk/chrome-extension'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import { useState } from 'react'
import { ProjectList } from './components/ProjectList'
import { ProjectDetail } from './components/ProjectDetail'
import { InsertPanel } from './components/InsertPanel'
import type { Project } from './types'

type AppTab = 'projects' | 'insert'

// Environment configuration
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
const SYNC_HOST = import.meta.env.VITE_SYNC_HOST || 'http://localhost:3000'

// Initialize Convex client
const convex = new ConvexReactClient(CONVEX_URL)

// Get the extension URL for redirects
const getExtensionUrl = () => {
  return chrome?.runtime?.getURL?.('.')
    ? `${chrome.runtime.getURL('.')}/popup.html`
    : '/popup.html'
}

export function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl={getExtensionUrl()}
      signInFallbackRedirectUrl={getExtensionUrl()}
      signUpFallbackRedirectUrl={getExtensionUrl()}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <AppContent />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function AppContent() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [activeTab, setActiveTab] = useState<AppTab>('insert')

  // Loading state
  if (!isLoaded) {
    return (
      <div className="app">
        <Header />
        <div className="loading">
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Signed out state - only show Insert tab (no auth required for manual JSON paste)
  if (!isSignedIn) {
    return (
      <div className="app">
        <Header />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} showProjects={false} />
        <div className="content">
          {activeTab === 'insert' ? (
            <InsertPanel />
          ) : (
            <div className="sign-in">
              <div className="sign-in-title">Sign in to Flow Bridge</div>
              <div className="sign-in-desc">
                Access your projects and copy components directly to Webflow Designer
              </div>
              <SignInButton mode="modal">
                <button className="btn btn-primary">Sign In</button>
              </SignInButton>
              <div className="sign-in-desc">
                Or sign in at <a href={SYNC_HOST} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>flowstach.com</a>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Signed in - show tabs with projects and insert
  const showBackButton = activeTab === 'projects' && !!selectedProject
  const headerTitle = activeTab === 'projects' && selectedProject ? selectedProject.name : undefined

  return (
    <div className="app">
      <Header
        showBack={showBackButton}
        onBack={() => setSelectedProject(null)}
        title={headerTitle}
      />
      <TabBar activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab)
        if (tab !== 'projects') {
          setSelectedProject(null)
        }
      }} showProjects={true} />
      <div className="content">
        {activeTab === 'insert' ? (
          <InsertPanel />
        ) : selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <ProjectList onSelectProject={setSelectedProject} />
        )}
      </div>
      <div className="user-info">
        {user?.imageUrl && (
          <img src={user.imageUrl} alt="" className="user-avatar" />
        )}
        <span className="user-email">
          {user?.primaryEmailAddress?.emailAddress}
        </span>
        <button className="sign-out-btn" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}

interface TabBarProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  showProjects: boolean
}

function TabBar({ activeTab, onTabChange, showProjects }: TabBarProps) {
  return (
    <div className="tab-bar">
      <button
        className={`tab-btn ${activeTab === 'insert' ? 'active' : ''}`}
        onClick={() => onTabChange('insert')}
      >
        🚀 Insert
      </button>
      {showProjects && (
        <button
          className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => onTabChange('projects')}
        >
          📁 Projects
        </button>
      )}
      <style>{`
        .tab-bar {
          display: flex;
          gap: 4px;
          padding: 8px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .tab-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          background: #e2e8f0;
          color: #334155;
        }
        .tab-btn.active {
          background: #3b82f6;
          color: white;
        }
      `}</style>
    </div>
  )
}

interface HeaderProps {
  showBack?: boolean
  onBack?: () => void
  title?: string
}

function Header({ showBack, onBack, title }: HeaderProps) {
  return (
    <header className="header">
      {showBack ? (
        <button className="header-back" onClick={onBack} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <div className="header-logo">FB</div>
      )}
      <span className="header-title">{title || 'Flow Bridge'}</span>
    </header>
  )
}
