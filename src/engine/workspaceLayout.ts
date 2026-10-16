export const WORKSPACE_MARGIN_RATIO = 0.25
export const WORKSPACE_CONTENT_RATIO = 1 / (1 + WORKSPACE_MARGIN_RATIO * 2)
export const WORKSPACE_SCALE = 1 / WORKSPACE_CONTENT_RATIO

export interface WorkspaceRect {
  x: number
  y: number
  width: number
  height: number
}

export function getWorkspaceContentRect(width: number, height: number): WorkspaceRect {
  const contentWidth = width * WORKSPACE_CONTENT_RATIO
  const contentHeight = height * WORKSPACE_CONTENT_RATIO
  return {
    x: (width - contentWidth) / 2,
    y: (height - contentHeight) / 2,
    width: contentWidth,
    height: contentHeight,
  }
}

export function getWorkspaceDimensions(imageWidth: number, imageHeight: number) {
  return { width: imageWidth * WORKSPACE_SCALE, height: imageHeight * WORKSPACE_SCALE }
}
