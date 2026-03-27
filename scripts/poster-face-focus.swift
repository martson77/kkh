import Foundation
import Vision
import ImageIO
import CoreGraphics

struct FocusResult: Codable {
  let focusX: Double
  let focusY: Double
  let faceCount: Int
}

enum DetectorError: Error {
  case invalidArguments
  case imageLoadFailed
}

func loadImage(at path: String) throws -> CGImage {
  let url = URL(fileURLWithPath: path)

  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw DetectorError.imageLoadFailed
  }

  return image
}

func detectFaces(in image: CGImage) throws -> [VNFaceObservation] {
  let request = VNDetectFaceRectanglesRequest()
  let handler = VNImageRequestHandler(cgImage: image, options: [:])
  try handler.perform([request])
  return (request.results as? [VNFaceObservation]) ?? []
}

func focusPoint(for faces: [VNFaceObservation]) -> FocusResult? {
  guard !faces.isEmpty else {
    return nil
  }

  var minX = 1.0
  var minY = 1.0
  var maxX = 0.0
  var maxY = 0.0

  for face in faces {
    minX = min(minX, face.boundingBox.minX)
    minY = min(minY, face.boundingBox.minY)
    maxX = max(maxX, face.boundingBox.maxX)
    maxY = max(maxY, face.boundingBox.maxY)
  }

  let centerX = min(max((minX + maxX) / 2.0, 0.0), 1.0)
  let centerY = min(max((minY + maxY) / 2.0, 0.0), 1.0)

  return FocusResult(
    focusX: centerX,
    focusY: centerY,
    faceCount: faces.count
  )
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
  fputs("Usage: poster-face-focus.swift <image-path>\n", stderr)
  exit(1)
}

do {
  let image = try loadImage(at: arguments[1])
  let faces = try detectFaces(in: image)

  guard let result = focusPoint(for: faces) else {
    print("{}")
    exit(0)
  }

  let encoder = JSONEncoder()
  let data = try encoder.encode(result)
  FileHandle.standardOutput.write(data)
} catch {
  fputs("\(error)\n", stderr)
  exit(1)
}
