package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/doopush/doopush/api/internal/database"
	"github.com/doopush/doopush/api/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrInvitationNotFound      = errors.New("邀请不存在")
	ErrInvitationNotPending    = errors.New("邀请已处理，无法重复操作")
	ErrPendingInvitationExists = errors.New("该用户已有待处理的应用邀请")
	ErrCannotInviteMember      = errors.New("该用户已经是应用成员")
)

type InvitationService struct{}

func NewInvitationService() *InvitationService {
	return &InvitationService{}
}

func (s *InvitationService) LookupCandidate(appID, operatorID uint, email string) (*models.AppInviteCandidate, error) {
	if err := NewAppService().requireOwner(database.DB, appID, operatorID); err != nil {
		return nil, err
	}

	email = strings.TrimSpace(strings.ToLower(email))
	var user models.User
	if err := database.DB.Where("LOWER(email) = ? AND status = 1", email).First(&user).Error; err != nil {
		return nil, ErrEmailUserNotFound
	}

	state := "available"
	var count int64
	if err := database.DB.Model(&models.UserAppPermission{}).
		Where("app_id = ? AND user_id = ?", appID, user.ID).Count(&count).Error; err != nil {
		return nil, errors.New("查询用户状态失败")
	}
	if count > 0 {
		state = "member"
	} else if err := database.DB.Model(&models.AppInvitation{}).
		Where("app_id = ? AND invitee_id = ? AND status = ?", appID, user.ID, "pending").Count(&count).Error; err != nil {
		return nil, errors.New("查询邀请状态失败")
	} else if count > 0 {
		state = "pending"
	}

	return &models.AppInviteCandidate{
		UserID: user.ID, Username: user.Username, Email: user.Email,
		Nickname: user.Nickname, Avatar: user.Avatar, State: state,
	}, nil
}

func (s *InvitationService) CreateInvitation(appID, inviterID, inviteeID uint, role string) (*models.AppInvitation, error) {
	if !isValidAppRole(role) {
		return nil, ErrInvalidAppRole
	}

	var invitation models.AppInvitation
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := NewAppService().requireOwner(tx, appID, inviterID); err != nil {
			return err
		}

		var app models.App
		if err := tx.Where("id = ? AND status = 1", appID).First(&app).Error; err != nil {
			return errors.New("应用不存在或已被禁用")
		}
		var inviter, invitee models.User
		if err := tx.Where("id = ? AND status = 1", inviterID).First(&inviter).Error; err != nil {
			return errors.New("邀请人不存在")
		}
		if err := tx.Where("id = ? AND status = 1", inviteeID).First(&invitee).Error; err != nil {
			return ErrEmailUserNotFound
		}

		var memberCount int64
		if err := tx.Model(&models.UserAppPermission{}).
			Where("app_id = ? AND user_id = ?", appID, inviteeID).Count(&memberCount).Error; err != nil {
			return errors.New("查询成员状态失败")
		}
		if memberCount > 0 {
			return ErrCannotInviteMember
		}

		pendingKey := fmt.Sprintf("%d:%d", appID, inviteeID)
		invitation = models.AppInvitation{
			AppID: appID, InviterID: inviterID, InviteeID: inviteeID,
			Role: role, Status: "pending", PendingKey: &pendingKey,
			AppNameSnapshot: app.Name, AppIconSnapshot: app.AppIcon,
			InviterNameSnapshot: displayUserName(inviter),
			InviteeNameSnapshot: displayUserName(invitee), InviteeEmailSnapshot: invitee.Email,
		}
		if err := tx.Create(&invitation).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) || isDuplicateEntryError(err) {
				return ErrPendingInvitationExists
			}
			return errors.New("创建应用邀请失败")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &invitation, nil
}

func (s *InvitationService) GetPendingInvitations(appID, operatorID uint) ([]models.AppInvitation, error) {
	if err := NewAppService().requireOwner(database.DB, appID, operatorID); err != nil {
		return nil, err
	}
	var invitations []models.AppInvitation
	if err := database.DB.Where("app_id = ? AND status = ?", appID, "pending").
		Order("created_at DESC").Find(&invitations).Error; err != nil {
		return nil, errors.New("获取待处理邀请失败")
	}
	return invitations, nil
}

func (s *InvitationService) CancelInvitation(appID, operatorID, invitationID uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		if err := NewAppService().requireOwner(tx, appID, operatorID); err != nil {
			return err
		}
		var invitation models.AppInvitation
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND app_id = ?", invitationID, appID).First(&invitation).Error; err != nil {
			return ErrInvitationNotFound
		}
		if invitation.Status != "pending" {
			return ErrInvitationNotPending
		}
		now := time.Now()
		return tx.Model(&invitation).Updates(map[string]interface{}{
			"status": "cancelled", "pending_key": nil, "responded_at": now, "read_at": nil,
		}).Error
	})
}

func (s *InvitationService) GetInbox(userID uint) ([]models.AppInvitation, error) {
	var invitations []models.AppInvitation
	if err := database.DB.Where("invitee_id = ?", userID).
		Order("created_at DESC").Limit(100).Find(&invitations).Error; err != nil {
		return nil, errors.New("获取收件箱失败")
	}
	return invitations, nil
}

func (s *InvitationService) GetUnreadCount(userID uint) (int64, error) {
	var count int64
	err := database.DB.Model(&models.AppInvitation{}).
		Where("invitee_id = ? AND read_at IS NULL", userID).Count(&count).Error
	return count, err
}

func (s *InvitationService) MarkRead(userID, invitationID uint) error {
	result := database.DB.Model(&models.AppInvitation{}).
		Where("id = ? AND invitee_id = ? AND read_at IS NULL", invitationID, userID).
		Update("read_at", time.Now())
	if result.Error != nil {
		return errors.New("更新已读状态失败")
	}
	return nil
}

func (s *InvitationService) MarkAllRead(userID uint) error {
	return database.DB.Model(&models.AppInvitation{}).
		Where("invitee_id = ? AND read_at IS NULL", userID).
		Update("read_at", time.Now()).Error
}

func (s *InvitationService) RespondInvitation(userID, invitationID uint, accept bool) (*models.AppInvitation, error) {
	var invitation models.AppInvitation
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND invitee_id = ?", invitationID, userID).First(&invitation).Error; err != nil {
			return ErrInvitationNotFound
		}
		if invitation.Status != "pending" {
			return ErrInvitationNotPending
		}

		now := time.Now()
		status := "rejected"
		if accept {
			var app models.App
			if err := tx.Where("id = ? AND status = 1", invitation.AppID).First(&app).Error; err != nil {
				return errors.New("应用不存在或已被禁用")
			}
			permission := models.UserAppPermission{
				UserID: userID, AppID: invitation.AppID, Role: invitation.Role,
			}
			if err := tx.Create(&permission).Error; err != nil {
				if errors.Is(err, gorm.ErrDuplicatedKey) || isDuplicateEntryError(err) {
					return ErrCannotInviteMember
				}
				return errors.New("接受应用邀请失败")
			}
			status = "accepted"
		}

		if err := tx.Model(&invitation).Updates(map[string]interface{}{
			"status": status, "pending_key": nil, "responded_at": now, "read_at": now,
		}).Error; err != nil {
			return errors.New("更新邀请状态失败")
		}
		invitation.Status = status
		invitation.PendingKey = nil
		invitation.RespondedAt = &now
		invitation.ReadAt = &now
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &invitation, nil
}

func displayUserName(user models.User) string {
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}
