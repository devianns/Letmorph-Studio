import { useCallback, useEffect, useRef, useState } from 'react'
import { createCharacterProject } from '../../application/createCharacterProject'
import type { CharacterProject } from '../../domain/project'
import { ImageInputError } from '../../core/image/validateImage'
import { createBrowserImagePreview, inspectBrowserImage, releaseBrowserImagePreview } from '../../platform/browser/inspectImage'

const errorMessages: Record<string, string> = {
  UNSUPPORTED_TYPE: 'PNG, JPG 또는 WebP 그림을 선택해 주세요.',
  EMPTY_FILE: '비어 있는 파일이에요. 다른 그림을 선택해 주세요.',
  FILE_TOO_LARGE: '파일 크기가 너무 커요. 50MB 이하의 그림을 선택해 주세요.',
  INVALID_IMAGE_DATA: '그림을 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.',
}

export function useCharacterProject() {
  const [project, setProject] = useState<CharacterProject>()
  const [imageUrl, setImageUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const previewRef = useRef<string | undefined>(undefined)
  const importSequence = useRef(0)

  useEffect(() => () => {
    importSequence.current += 1
    if (previewRef.current) releaseBrowserImagePreview(previewRef.current)
  }, [])

  const importImage = useCallback(async (file?: File) => {
    if (!file) return
    const sequence = ++importSequence.current
    setError(undefined)
    setIsLoading(true)

    try {
      const nextProject = await createCharacterProject(file, {
        inspectImage: inspectBrowserImage,
        createId: () => crypto.randomUUID(),
      })
      if (sequence !== importSequence.current) return

      const nextUrl = createBrowserImagePreview(file)
      if (previewRef.current) releaseBrowserImagePreview(previewRef.current)
      previewRef.current = nextUrl
      setProject(nextProject)
      setImageUrl(nextUrl)
    } catch (cause) {
      if (sequence !== importSequence.current) return
      const code = cause instanceof ImageInputError ? cause.code : 'INVALID_IMAGE_DATA'
      setError(errorMessages[code])
    } finally {
      if (sequence === importSequence.current) setIsLoading(false)
    }
  }, [])

  const clearProject = useCallback(() => {
    importSequence.current += 1
    if (previewRef.current) releaseBrowserImagePreview(previewRef.current)
    previewRef.current = undefined
    setProject(undefined)
    setImageUrl(undefined)
    setError(undefined)
    setIsLoading(false)
  }, [])

  return { project, imageUrl, error, isLoading, importImage, clearProject }
}
