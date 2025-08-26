package controllers

import (
	"net/http"

	"github.com/doopush/doopush/api/internal/services"
	"github.com/doopush/doopush/api/pkg/response"
	"github.com/gin-gonic/gin"
)

// AuthController 认证控制器
type AuthController struct {
	userService *services.UserService
}

// NewAuthController 创建认证控制器
func NewAuthController() *AuthController {
	return &AuthController{
		userService: services.NewUserService(),
	}
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50" example:"admin"`
	Email    string `json:"email" binding:"required,email" example:"admin@example.com"`
	Password string `json:"password" binding:"required,min=6" example:"password123"`
	Nickname string `json:"nickname" example:"管理员"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required" example:"admin"`
	Password string `json:"password" binding:"required" example:"password123"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	User  interface{} `json:"user"`
	Token string      `json:"token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
}

// Register 用户注册
// @Summary 用户注册
// @Description 创建新用户账户
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "注册信息"
// @Success 201 {object} response.APIResponse{data=models.User}
// @Failure 400 {object} response.APIResponse
// @Failure 422 {object} response.APIResponse
// @Router /auth/register [post]
func (a *AuthController) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	user, err := a.userService.Register(req.Username, req.Email, req.Password)
	if err != nil {
		response.Error(c, http.StatusUnprocessableEntity, err.Error())
		return
	}

	// 设置昵称
	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}

	c.JSON(http.StatusCreated, response.APIResponse{
		Code:    201,
		Message: "注册成功",
		Data:    user,
	})
}

// Login 用户登录
// @Summary 用户登录
// @Description 用户登录获取JWT令牌
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body LoginRequest true "登录信息"
// @Success 200 {object} response.APIResponse{data=LoginResponse}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Router /auth/login [post]
func (a *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	user, token, err := a.userService.Login(req.Username, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.Success(c, LoginResponse{
		User:  user,
		Token: token,
	})
}

// Profile 获取用户信息
// @Summary 获取当前用户信息
// @Description 获取当前登录用户的详细信息
// @Tags 认证
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.APIResponse{data=models.User}
// @Failure 401 {object} response.APIResponse
// @Router /auth/profile [get]
func (a *AuthController) Profile(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "未认证")
		return
	}

	user, err := a.userService.GetUserByID(userID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.Success(c, user)
}

// UpdateProfileRequest 更新用户信息请求
type UpdateProfileRequest struct {
	Nickname string `json:"nickname" example:"管理员"`
	Avatar   string `json:"avatar" example:"https://example.com/avatar.jpg"`
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required" example:"oldpassword"`
	NewPassword string `json:"new_password" binding:"required,min=6" example:"newpassword"`
}

// UpdateProfile 更新用户信息
// @Summary 更新用户信息
// @Description 更新当前用户的基本信息（昵称、头像）
// @Tags 认证
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateProfileRequest true "更新信息"
// @Success 200 {object} response.APIResponse{data=models.User}
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Router /auth/profile [put]
func (a *AuthController) UpdateProfile(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "未认证")
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	user, err := a.userService.UpdateProfile(userID, req.Nickname, req.Avatar)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}

	response.Success(c, user)
}

// ChangePassword 修改密码
// @Summary 修改密码
// @Description 修改当前用户的登录密码
// @Tags 认证
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ChangePasswordRequest true "密码信息"
// @Success 200 {object} response.APIResponse
// @Failure 400 {object} response.APIResponse
// @Failure 401 {object} response.APIResponse
// @Router /auth/password [put]
func (a *AuthController) ChangePassword(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "未认证")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	err := a.userService.ChangePassword(userID, req.OldPassword, req.NewPassword)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "密码修改成功"})
}

// UserApps 获取用户应用列表
// @Summary 获取用户应用列表
// @Description 获取当前用户有权限的应用列表
// @Tags 认证
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.APIResponse{data=[]models.App}
// @Failure 401 {object} response.APIResponse
// @Router /auth/apps [get]
func (a *AuthController) UserApps(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		response.Unauthorized(c, "未认证")
		return
	}

	apps, err := a.userService.GetUserApps(userID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}

	response.Success(c, apps)
}
