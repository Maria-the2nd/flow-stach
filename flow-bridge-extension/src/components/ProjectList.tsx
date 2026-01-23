import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Project } from '../types'

interface ProjectListProps {
  onSelectProject: (project: Project) => void
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const projects = useQuery(api.projects.listMine)

  if (projects === undefined) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading projects...</span>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📦</div>
        <div className="empty-title">No projects yet</div>
        <div className="empty-desc">
          Import HTML at flowstach.com to create your first project
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-title">Your Projects</div>
      <div className="project-list">
        {projects.map((project) => (
          <div
            key={project._id}
            className="project-card"
            onClick={() => onSelectProject(project as Project)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectProject(project as Project)
              }
            }}
          >
            <div className="project-name">{project.name}</div>
            <div className="project-meta">
              <span className="project-status">
                <span className={`status-dot ${project.status}`} />
                {project.status === 'complete' ? 'Complete' : 'Draft'}
              </span>
              {project.componentCount !== undefined && (
                <span>{project.componentCount} components</span>
              )}
              {project.classCount !== undefined && (
                <span>{project.classCount} classes</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
