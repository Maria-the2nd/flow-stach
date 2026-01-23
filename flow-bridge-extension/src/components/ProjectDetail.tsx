import { useQuery, useConvex } from 'convex/react'
import { useState } from 'react'
import { api } from '@/convex/_generated/api'
import type { Project, Artifact, MessageResponse, ArtifactType } from '../types'
import { ARTIFACT_CONFIG } from '../types'
import type { Id } from '@/convex/_generated/dataModel'

interface ProjectDetailProps {
  project: Project
  onBack: () => void
}

export function ProjectDetail({ project }: ProjectDetailProps) {
  const [copyStatus, setCopyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [copyingArtifact, setCopyingArtifact] = useState<string | null>(null)
  const convex = useConvex()

  const data = useQuery(api.projects.getWithArtifacts, {
    projectId: project._id as Id<'importProjects'>
  })

  const handleCopy = async (artifact: Artifact) => {
    const config = ARTIFACT_CONFIG[artifact.type]
    if (!config.copyable) return

    setCopyingArtifact(artifact._id)
    setCopyStatus(null)

    try {
      // Fetch artifact content using Convex client directly
      const content = await convex.query(api.projects.getArtifactContent, {
        artifactId: artifact._id as Id<'importArtifacts'>
      })

      if (!content) {
        throw new Error('Artifact content not found')
      }

      // Determine if this should use Webflow clipboard format
      const isWebflowJson = artifact.type === 'token_webflow_json'

      // Send to background script for clipboard
      const response: MessageResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: isWebflowJson ? 'COPY_WEBFLOW_JSON' : 'COPY_TEXT',
            payload: content.content,
          },
          resolve
        )
      })

      if (response.success) {
        setCopyStatus({ type: 'success', message: `${config.label} copied!` })
      } else {
        setCopyStatus({ type: 'error', message: response.error || 'Failed to copy' })
      }
    } catch (error) {
      setCopyStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to copy',
      })
    } finally {
      setCopyingArtifact(null)
      // Auto-dismiss after 3 seconds
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  if (data === undefined) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading artifacts...</span>
      </div>
    )
  }

  const { artifacts } = data
  const copyableArtifacts = artifacts.filter(
    (a) => ARTIFACT_CONFIG[a.type as ArtifactType]?.copyable
  )

  if (copyableArtifacts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <div className="empty-title">No copyable artifacts</div>
        <div className="empty-desc">
          This project doesn't have any artifacts that can be copied
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-title">Artifacts</div>
      <div className="artifact-list">
        {copyableArtifacts.map((artifact) => {
          const config = ARTIFACT_CONFIG[artifact.type as ArtifactType]
          const isCopying = copyingArtifact === artifact._id

          return (
            <div key={artifact._id} className="artifact-card">
              <div className="artifact-type">
                <span className="artifact-icon">{config.icon}</span>
                <span>{config.label}</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(artifact as Artifact)}
                disabled={isCopying}
              >
                {isCopying ? 'Copying...' : 'Copy'}
              </button>
            </div>
          )
        })}
      </div>

      {copyStatus && (
        <div className={copyStatus.type === 'success' ? 'copy-success' : 'copy-error'}>
          {copyStatus.message}
        </div>
      )}
    </div>
  )
}
