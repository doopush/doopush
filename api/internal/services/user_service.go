package services

import (
	"errors"

	"github.com/doopush/doopush/api/internal/config"
	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"github.com/doopush/doopush/api/pkg/auth"
	"github.com/doopush/doopush/api/pkg/utils"
	"golang.org/x/crypto/bcrypt"
)

// UserService 用户服务
type UserService struct{}

// NewUserService 创建用户服务
func NewUserService() *UserService {
	return &UserService{}
}

// Register 用户注册
func (s *UserService) Register(username, email, password string) (*models.User, error) {
	// 检查用户名是否已存在
	var existingUser models.User
	if err := database.DB.Where("username = ? OR email = ?", username, email).First(&existingUser).Error; err == nil {
		return nil, errors.New("用户名或邮箱已存在")
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("密码加密失败")
	}

	// 创建用户
	user := &models.User{
		Username: username,
		Email:    email,
		Password: string(hashedPassword),
		Nickname: username,
		Status:   1,
	}

	if err := database.DB.Create(user).Error; err != nil {
		return nil, errors.New("用户创建失败")
	}

	// 不返回密码
	user.Password = ""
	return user, nil
}

// Login 用户登录
func (s *UserService) Login(username, password string) (*models.User, string, error) {
	// 查找用户
	var user models.User
	if err := database.DB.Where("(username = ? OR email = ?) AND status = 1", username, username).First(&user).Error; err != nil {
		return nil, "", errors.New("用户不存在或已禁用")
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, "", errors.New("密码错误")
	}

	// 生成JWT令牌
	jwtService := auth.NewJWTService(
		config.GetString("JWT_SECRET"),
		config.GetString("JWT_ISSUER"),
	)
	token, err := jwtService.GenerateToken(user.ID, user.Username, user.Email)
	if err != nil {
		return nil, "", errors.New("令牌生成失败")
	}

	// 更新最后登录时间
	now := utils.TimeNow()
	user.LastLogin = &now
	database.DB.Model(&user).Update("last_login", now)

	// 不返回密码
	user.Password = ""
	return &user, token, nil
}

// GetUserByID 根据ID获取用户
func (s *UserService) GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := database.DB.Where("id = ? AND status = 1", userID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	user.Password = ""
	return &user, nil
}

// GetUserApps 获取用户有权限的应用列表
func (s *UserService) GetUserApps(userID uint) ([]models.App, error) {
	var apps []models.App

	// 通过用户权限表连接查询
	err := database.DB.Table("apps").
		Joins("JOIN user_app_permissions ON apps.id = user_app_permissions.app_id").
		Where("user_app_permissions.user_id = ? AND apps.status = 1", userID).
		Find(&apps).Error

	if err != nil {
		return nil, errors.New("获取用户应用失败")
	}

	return apps, nil
}

// UpdateProfile 更新用户信息
func (s *UserService) UpdateProfile(userID uint, nickname, avatar string) (*models.User, error) {
	var user models.User
	if err := database.DB.Where("id = ? AND status = 1", userID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if nickname != "" {
		updates["nickname"] = nickname
	}
	if avatar != "" {
		updates["avatar"] = avatar
	}

	// 执行更新
	if len(updates) > 0 {
		if err := database.DB.Model(&user).Updates(updates).Error; err != nil {
			return nil, errors.New("用户信息更新失败")
		}
	}

	// 重新获取用户信息
	if err := database.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, errors.New("获取用户信息失败")
	}

	user.Password = ""
	return &user, nil
}

// ChangePassword 修改密码
func (s *UserService) ChangePassword(userID uint, oldPassword, newPassword string) error {
	var user models.User
	if err := database.DB.Where("id = ? AND status = 1", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return errors.New("原密码错误")
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}

	// 更新密码
	if err := database.DB.Model(&user).Update("password", string(hashedPassword)).Error; err != nil {
		return errors.New("密码更新失败")
	}

	return nil
}

// CheckAppPermission 检查用户对应用的权限
func (s *UserService) CheckAppPermission(userID, appID uint, requiredRole string) (bool, error) {
	var permission models.UserAppPermission
	err := database.DB.Where("user_id = ? AND app_id = ?", userID, appID).First(&permission).Error
	if err != nil {
		return false, nil // 无权限
	}

	// 权限等级: owner > developer > viewer
	roleLevel := map[string]int{
		"viewer":    1,
		"developer": 2,
		"owner":     3,
	}

	userLevel := roleLevel[permission.Role]
	requiredLevel := roleLevel[requiredRole]

	return userLevel >= requiredLevel, nil
}
