import { useCallback, useEffect, useRef, useState } from 'react'
import { createCharacterProject } from '../../application/createCharacterProject'
import type { CharacterProject } from '../../domain/project'
import { ImageInputError } from '../../core/image/validateImage'
import { deserializePortableProjectFile, maxPortableProjectFileBytes } from '../../application/portableProjectFile'
import type { EditorDocument } from '../../domain/editorDocument'
import { createBrowserFileFromDataUrl, createBrowserImagePreview, inspectBrowserImage, readBrowserFileText, releaseBrowserImagePreview } from '../../platform/browser/inspectImage'

const errorMessages: Record<string, string> = {
  UNSUPPORTED_TYPE: 'PNG, JPG 또는 WebP 그림을 선택해 주세요.',
  EMPTY_FILE: '비어 있는 파일이에요. 다른 그림을 선택해 주세요.',
  FILE_TOO_LARGE: '파일 크기가 너무 커요. 50MB 이하의 그림을 선택해 주세요.',
  INVALID_IMAGE_DATA: '그림을 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.',
}

export function useCharacterProject() {
  const [imageUrl, setImageUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const previewRef = useRef<string | undefined>(undefined)
  const importSequence = useRef(0)

  useEffect(() => () => {
    importSequence.current += 1
    if (previewRef.current) releaseBrowserImagePreview(previewRef.current)
  }, [])

  const importImage = useCallback(async (file?: File, restoredProject?: CharacterProject): Promise<CharacterProject | undefined> => {
    if (!file) return undefined
    const sequence = ++importSequence.current
    setError(undefined)
    setIsLoading(true)

    try {
      const inspectedProject = await createCharacterProject(file, {
        inspectImage: inspectBrowserImage,
        createId: () => crypto.randomUUID(),
      })
      if (sequence !== importSequence.current) return

      const nextProject = restoredProject
        ? { ...restoredProject, sourceImage: inspectedProject.sourceImage }
        : inspectedProject

      const nextUrl = createBrowserImagePreview(file)
      if (previewRef.current) releaseBrowserImagePreview(previewRef.current)
      previewRef.current = nextUrl
      setImageUrl(nextUrl)
      return nextProject
    } catch (cause) {
      if (sequence !== importSequence.current) return
      const code = cause instanceof ImageInputError ? cause.code : 'INVALID_IMAGE_DATA'
      setError(errorMessages[code])
      return undefined
    } finally {
      if (sequence === importSequence.current) setIsLoading(false)
    }
  }, [])

  const importProjectFile = useCallback(async (file?: File): Promise<EditorDocument | undefined> => {
    if (!file) return undefined
    const sequence = ++importSequence.current
    setError(undefined)
    setIsLoading(true)
    try {
      const fileContents = await readBrowserFileText(file, maxPortableProjectFileBytes)
      const { document, sourceImageDataUrl } = deserializePortableProjectFile(fileContents, file.size)
      if (sequence !== importSequence.current) return undefined
      if (!document.project) throw new Error('작업 파일에 프로젝트 정보가 없습니다.')
      const sourceImage = createBrowserFileFromDataUrl(sourceImageDataUrl, document.project.sourceImage.fileName, document.project.sourceImage.mimeType)
      const restoredProject = await importImage(sourceImage, document.project)
      return restoredProject ? { ...document, project: restoredProject } : undefined
    } catch (cause) {
      if (sequence === importSequence.current) setError(cause instanceof Error ? cause.message : '작업 파일을 가져오지 못했습니다.')
      return undefined
    } finally {
      if (sequence === importSequence.current) setIsLoading(false)
    }
  }, [importImage])

  const clearProject = useCallback(() => {
    importSequence.current += 1
    if (previewRef.current) releaseBrowserImagePreview(previewRef.current)
    previewRef.current = undefined
    setImageUrl(undefined)
    setError(undefined)
    setIsLoading(false)
  }, [])

  return { imageUrl, error, isLoading, importImage, importProjectFile, clearProject }
}
