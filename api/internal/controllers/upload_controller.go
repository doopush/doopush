package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/doopush/doopush/api/pkg/utils"
	"github.com/gin-gonic/gin"
)

// uploadImageSize 上传位图统一缩放的最大边长（像素）
const uploadImageSize = 256

// maxSVGSize SVG 原样保存，单独限制大小
const maxSVGSize = 200 * 1024

// UploadController 文件上传控制器
type UploadController struct{}

// NewUploadController 创建文件上传控制器
func NewUploadController() *UploadController {
	return &UploadController{}
}

// UploadResponse 上传响应
type UploadResponse struct {
	Filename string `json:"filename" example:"app_icon_123456.png"`
	URL      string `json:"url" example:"/uploads/icons/app_icon_123456.png"`
	Size     int64  `json:"size" example:"12345"`
}

// UploadImage 上传图片
// @Summary 上传图片
// @Description 上传图片文件，支持应用图标等图片上传，需要用户身份认证
// @Tags 文件上传
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param file formData file true "图片文件"
// @Param type query string false "上传类型" Enums(app_icon,avatar) default(app_icon)
// @Success 200 {object} response.APIResponse{data=UploadResponse}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 413 {object} response.APIResponse
// @Router /upload/image [post]
func (u *UploadController) UploadImage(c *gin.Context) {
	// 获取当前用户ID（由JWT中间件设置）
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "用户未认证")
		return
	}

	// 获取上传类型，默认为应用图标
	uploadType := c.DefaultQuery("type", "app_icon")

	// 支持的上传类型
	allowedTypes := map[string]bool{
		"app_icon": true,
		"avatar":   true,
	}

	if !allowedTypes[uploadType] {
		response.BadRequest(c, "不支持的上传类型")
		return
	}

	// 获取上传文件
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "未找到上传文件")
		return
	}
	defer file.Close()

	// 验证文件大小 (5MB限制)
	maxSize := int64(5 * 1024 * 1024)
	if header.Size > maxSize {
		response.Error(c, http.StatusRequestEntityTooLarge, "文件大小不能超过5MB")
		return
	}

	// 验证文件类型
	contentType := header.Header.Get("Content-Type")
	allowedMimeTypes := map[string]bool{
		"image/jpeg":    true,
		"image/png":     true,
		"image/gif":     true,
		"image/webp":    true,
		"image/svg+xml": true,
	}

	if !allowedMimeTypes[contentType] {
		response.BadRequest(c, "不支持的文件类型，仅支持 JPEG、PNG、GIF、WebP、SVG 格式")
		return
	}

	// 验证文件扩展名
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".svg":  true,
	}

	if !allowedExts[ext] {
		response.BadRequest(c, "不支持的文件扩展名")
		return
	}

	// 读取文件内容（已限制5MB），按实际内容校验，不信任客户端声明的类型
	data, err := io.ReadAll(io.LimitReader(file, maxSize+1))
	if err != nil || int64(len(data)) > maxSize {
		response.BadRequest(c, "文件读取失败")
		return
	}

	if ext == ".svg" {
		// SVG 为矢量图，原样保存（访问时由 /uploads 响应头禁止执行脚本）
		if len(data) > maxSVGSize {
			response.Error(c, http.StatusRequestEntityTooLarge, "SVG 文件大小不能超过200KB")
			return
		}
		if !utils.LooksLikeSVG(data) {
			response.BadRequest(c, "文件内容与类型不符")
			return
		}
		contentType = "image/svg+xml"
	} else {
		// 位图统一居中裁剪为正方形并缩放到 256×256 以内，存为 PNG
		data, err = utils.SquareThumbnailPNG(data, uploadImageSize)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		ext = ".png"
		contentType = "image/png"
	}

	// 创建上传目录
	uploadDir := "uploads"
	typeDir := filepath.Join(uploadDir, getUploadSubDir(uploadType))

	if err := os.MkdirAll(typeDir, 0755); err != nil {
		response.InternalServerError(c, "创建上传目录失败")
		return
	}

	// 生成唯一文件名（时间戳 + 随机后缀，避免同一秒内上传互相覆盖）
	filename := fmt.Sprintf("%s_%d_%s%s", uploadType, time.Now().Unix(), randomHex(4), ext)
	filePath := filepath.Join(typeDir, filename)

	// 创建目标文件（O_EXCL 保证不覆盖已有文件）
	dst, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		response.InternalServerError(c, "创建文件失败")
		return
	}
	_, err = dst.Write(data)
	if closeErr := dst.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		// 清理已创建的文件
		os.Remove(filePath)
		response.InternalServerError(c, "文件保存失败")
		return
	}
	size := int64(len(data))

	// 构建返回URL
	url := "/" + strings.ReplaceAll(filePath, "\\", "/")

	// 保存文件记录到数据库
	uploadFile := &models.UploadFile{
		UserID:           userID,
		OriginalFilename: header.Filename,
		Filename:         filename,
		FilePath:         filePath,
		FileURL:          url,
		FileSize:         size,
		MimeType:         contentType,
		UploadType:       uploadType,
		Status:           1,
	}

	if err := database.DB.Create(uploadFile).Error; err != nil {
		// 如果数据库保存失败，删除已上传的文件
		os.Remove(filePath)
		response.InternalServerError(c, "文件记录保存失败")
		return
	}

	response.Success(c, UploadResponse{
		Filename: filename,
		URL:      url,
		Size:     size,
	})
}

// randomHex 生成 n 字节的随机十六进制串
func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// getUploadSubDir 根据上传类型获取子目录
func getUploadSubDir(uploadType string) string {
	switch uploadType {
	case "app_icon":
		return "icons"
	case "avatar":
		return "avatars"
	default:
		return "misc"
	}
}

// DeleteUploadedFile 删除上传的文件
// @Summary 删除上传文件
// @Description 删除之前上传的文件，需要用户身份认证
// @Tags 文件上传
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param url query string true "文件URL"
// @Success 200 {object} response.APIResponse
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Failure 403 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /upload/delete [delete]
func (u *UploadController) DeleteUploadedFile(c *gin.Context) {
	// 获取当前用户ID（由JWT中间件设置）
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "用户未认证")
		return
	}

	fileURL := c.Query("url")
	if fileURL == "" {
		response.BadRequest(c, "文件URL不能为空")
		return
	}

	// 确保URL以 /uploads/ 开头，防止删除其他文件
	if !strings.HasPrefix(fileURL, "/uploads/") {
		response.BadRequest(c, "无效的文件URL")
		return
	}

	// 查找文件记录
	var uploadFile models.UploadFile
	if err := database.DB.Where("file_url = ? AND status = 1", fileURL).First(&uploadFile).Error; err != nil {
		response.NotFound(c, "文件记录不存在")
		return
	}

	// 验证文件所有权（只有上传者才能删除）
	if uploadFile.UserID != userID {
		response.Forbidden(c, "无权限删除该文件")
		return
	}

	// 转换为文件路径
	filePath := strings.TrimPrefix(fileURL, "/")

	// 检查物理文件是否存在并删除
	if _, err := os.Stat(filePath); err == nil {
		if err := os.Remove(filePath); err != nil {
			response.InternalServerError(c, "删除物理文件失败")
			return
		}
	}

	// 更新数据库记录状态为已删除
	if err := database.DB.Model(&uploadFile).Update("status", 0).Error; err != nil {
		response.InternalServerError(c, "更新文件状态失败")
		return
	}

	response.Success(c, gin.H{"message": "文件删除成功"})
}

// UserFilesResponse 用户文件列表响应
type UserFilesResponse struct {
	Files      []models.UploadFile `json:"files"`
	Pagination PaginationInfo      `json:"pagination"`
}

// PaginationInfo 分页信息
type PaginationInfo struct {
	Page      int   `json:"page" example:"1"`
	Limit     int   `json:"limit" example:"20"`
	Total     int64 `json:"total" example:"100"`
	TotalPage int   `json:"total_page" example:"5"`
}

// GetUserFiles 获取用户上传文件列表
// @Summary 获取用户上传文件列表
// @Description 获取当前用户上传的文件记录列表，支持分页
// @Tags 文件上传
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param type query string false "文件类型筛选" Enums(app_icon,avatar)
// @Param page query int false "页码" default(1) minimum(1)
// @Param limit query int false "每页数量" default(20) minimum(1) maximum(100)
// @Success 200 {object} response.APIResponse{data=UserFilesResponse}
// @Failure 401 {object} response.APIResponse
// @Router /upload/files [get]
func (u *UploadController) GetUserFiles(c *gin.Context) {
	// 获取当前用户ID（由JWT中间件设置）
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "用户未认证")
		return
	}

	// 获取查询参数
	uploadType := c.Query("type")
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")

	// 解析分页参数
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100 // 限制最大每页数量
	}

	// 构建查询条件
	query := database.DB.Where("user_id = ? AND status = 1", userID)

	if uploadType != "" {
		query = query.Where("upload_type = ?", uploadType)
	}

	// 获取总数
	var total int64
	if err := query.Model(&models.UploadFile{}).Count(&total).Error; err != nil {
		response.InternalServerError(c, "获取文件总数失败")
		return
	}

	// 计算分页
	offset := (page - 1) * limit
	totalPage := int((total + int64(limit) - 1) / int64(limit)) // 向上取整

	// 获取文件列表
	var files []models.UploadFile
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&files).Error; err != nil {
		response.InternalServerError(c, "获取文件列表失败")
		return
	}

	// 构建响应
	responseData := UserFilesResponse{
		Files: files,
		Pagination: PaginationInfo{
			Page:      page,
			Limit:     limit,
			Total:     total,
			TotalPage: totalPage,
		},
	}

	response.Success(c, responseData)
}
