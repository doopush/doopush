package utils

import (
	"bytes"
	"errors"
	"image"
	_ "image/gif" // 注册 GIF 解码（只取第一帧）
	_ "image/jpeg"
	"image/png"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// maxImagePixels 解码前的像素上限，防止超大尺寸图片耗尽内存
const maxImagePixels = 40_000_000

// SquareThumbnailPNG 将位图居中裁剪为正方形，缩放到不超过 size×size（小图不放大），输出 PNG（保留透明）。
// 支持 JPEG/PNG/GIF/WebP，无法识别的内容返回错误。
func SquareThumbnailPNG(data []byte, size int) ([]byte, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("无法识别的图片内容")
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > maxImagePixels {
		return nil, errors.New("图片尺寸过大")
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("图片解码失败")
	}

	bounds := src.Bounds()
	side := min(bounds.Dx(), bounds.Dy())
	x0 := bounds.Min.X + (bounds.Dx()-side)/2
	y0 := bounds.Min.Y + (bounds.Dy()-side)/2
	crop := image.Rect(x0, y0, x0+side, y0+side)

	target := min(side, size)
	dst := image.NewNRGBA(image.Rect(0, 0, target, target))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, crop, draw.Src, nil)

	var buf bytes.Buffer
	encoder := png.Encoder{CompressionLevel: png.BestCompression}
	if err := encoder.Encode(&buf, dst); err != nil {
		return nil, errors.New("图片编码失败")
	}
	return buf.Bytes(), nil
}

// LooksLikeSVG 粗略校验内容是否为 SVG 文档（扩展名之外的内容校验）
func LooksLikeSVG(data []byte) bool {
	head := data
	if len(head) > 4096 {
		head = head[:4096]
	}
	return bytes.Contains(bytes.ToLower(head), []byte("<svg"))
}
