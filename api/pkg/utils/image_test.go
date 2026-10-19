package utils

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

func decodeSize(t *testing.T, data []byte) (int, int) {
	t.Helper()
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("decode output: %v", err)
	}
	if format != "png" {
		t.Fatalf("output format = %s, want png", format)
	}
	return cfg.Width, cfg.Height
}

func TestSquareThumbnailPNGCropsAndScales(t *testing.T) {
	// 800×400：中间 400×400 为红色，两侧为蓝色，裁剪后应只剩红色
	src := image.NewNRGBA(image.Rect(0, 0, 800, 400))
	for y := 0; y < 400; y++ {
		for x := 0; x < 800; x++ {
			c := color.NRGBA{B: 255, A: 255}
			if x >= 200 && x < 600 {
				c = color.NRGBA{R: 255, A: 255}
			}
			src.Set(x, y, c)
		}
	}
	out, err := SquareThumbnailPNG(encodePNG(t, src), 256)
	if err != nil {
		t.Fatalf("thumbnail: %v", err)
	}
	if w, h := decodeSize(t, out); w != 256 || h != 256 {
		t.Fatalf("size = %dx%d, want 256x256", w, h)
	}
	img, _ := png.Decode(bytes.NewReader(out))
	for _, p := range []image.Point{{0, 0}, {255, 128}, {128, 255}} {
		if r, _, b, _ := img.At(p.X, p.Y).RGBA(); r>>8 < 250 || b>>8 > 5 {
			t.Fatalf("pixel %v not red after center crop", p)
		}
	}
}

func TestSquareThumbnailPNGKeepsSmallImageAndAlpha(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 64, 100))
	out, err := SquareThumbnailPNG(encodePNG(t, src), 256)
	if err != nil {
		t.Fatalf("thumbnail: %v", err)
	}
	if w, h := decodeSize(t, out); w != 64 || h != 64 {
		t.Fatalf("size = %dx%d, want 64x64 (no upscaling)", w, h)
	}
	img, _ := png.Decode(bytes.NewReader(out))
	if _, _, _, a := img.At(10, 10).RGBA(); a != 0 {
		t.Fatalf("transparent pixel lost alpha: %d", a)
	}
}

func TestSquareThumbnailPNGAcceptsJPEG(t *testing.T) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 300, 300)), nil); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}
	out, err := SquareThumbnailPNG(buf.Bytes(), 256)
	if err != nil {
		t.Fatalf("thumbnail: %v", err)
	}
	if w, h := decodeSize(t, out); w != 256 || h != 256 {
		t.Fatalf("size = %dx%d, want 256x256", w, h)
	}
}

func TestSquareThumbnailPNGRejectsNonImage(t *testing.T) {
	if _, err := SquareThumbnailPNG([]byte("<html>not an image</html>"), 256); err == nil {
		t.Fatal("expected error for non-image content")
	}
}

func TestLooksLikeSVG(t *testing.T) {
	if !LooksLikeSVG([]byte(`<?xml version="1.0"?><SVG xmlns="http://www.w3.org/2000/svg"></SVG>`)) {
		t.Fatal("svg not detected")
	}
	if LooksLikeSVG([]byte("\x89PNG\r\n")) {
		t.Fatal("png detected as svg")
	}
}
