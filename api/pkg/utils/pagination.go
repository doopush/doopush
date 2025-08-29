package utils

import (
	"encoding/json"
	"reflect"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// SortField 排序字段
type SortField struct {
	Key  string `json:"key" form:"key" validate:"required"` // 排序字段名
	Desc bool   `json:"desc" form:"desc"`                   // true: 降序, false: 升序
}

// PaginationRequest 统一分页请求结构
type PaginationRequest struct {
	Page     int                    `json:"page" form:"page,default=1" validate:"min=1"`                    // 页码
	PageSize int                    `json:"page_size" form:"page_size,default=20" validate:"min=1,max=200"` // 每页条数，默认20
	Sorts    []SortField            `json:"sorts" form:"sorts"`                                             // 排序字段数组
	Filters  map[string]interface{} `json:"filters" form:"filters"`                                         // 筛选条件，每个接口可定义不同结构
}

// PaginationResponse 统一分页响应结构
type PaginationResponse[T any] struct {
	CurrentPage int   `json:"current_page"` // 当前页码
	PageSize    int   `json:"page_size"`    // 每页条数
	TotalItems  int64 `json:"total_items"`  // 总条数
	TotalPages  int   `json:"total_pages"`  // 总页数
	Data        T     `json:"data"`         // 数据，使用泛型支持不同数据结构
}

// NewPaginationResponse 创建分页响应
func NewPaginationResponse[T any](page, pageSize int, totalItems int64, data T) PaginationResponse[T] {
	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages < 1 {
		totalPages = 1
	}

	return PaginationResponse[T]{
		CurrentPage: page,
		PageSize:    pageSize,
		TotalItems:  totalItems,
		TotalPages:  totalPages,
		Data:        data,
	}
}

// GetOffset 计算查询偏移量
func (p *PaginationRequest) GetOffset() int {
	return (p.Page - 1) * p.PageSize
}

// GetOrderBy 获取排序SQL字符串
func (p *PaginationRequest) GetOrderBy() string {
	if len(p.Sorts) == 0 {
		return "created_at DESC"
	}

	orderParts := make([]string, len(p.Sorts))
	for i, sort := range p.Sorts {
		direction := "ASC"
		if sort.Desc {
			direction = "DESC"
		}
		orderParts[i] = sort.Key + " " + direction
	}

	return strings.Join(orderParts, ", ")
}

// ValidateSortField 验证排序字段是否在允许的字段列表中
func ValidateSortField(key string, allowedFields []string) bool {
	for _, allowed := range allowedFields {
		if key == allowed {
			return true
		}
	}
	return false
}

// SetDefaultSort 设置默认排序（如果没有提供排序条件）
func (p *PaginationRequest) SetDefaultSort(key string, desc bool) {
	if len(p.Sorts) == 0 {
		p.Sorts = []SortField{
			{Key: key, Desc: desc},
		}
	}
}

// SetDefaultSorts 设置多个默认排序（如果没有提供排序条件）
func (p *PaginationRequest) SetDefaultSorts(m map[string]bool) {
	if len(p.Sorts) == 0 {
		for key, desc := range m {
			p.Sorts = append(p.Sorts, SortField{Key: key, Desc: desc})
		}
	}
}

// ParseFilters 解析筛选条件
func (p *PaginationRequest) ParseFiltersFromQuery(c *gin.Context, filtersStructure interface{}) error {
	filtersMap := map[string]interface{}{}

	// 使用反射获取结构体类型信息
	structType := reflect.TypeOf(filtersStructure)
	if structType.Kind() == reflect.Ptr {
		structType = structType.Elem()
	}

	// 创建字段类型映射
	fieldTypes := make(map[string]reflect.Type)
	if structType.Kind() == reflect.Struct {
		for i := 0; i < structType.NumField(); i++ {
			field := structType.Field(i)
			// 获取json标签名，如果没有则使用字段名
			jsonTag := field.Tag.Get("json")
			fieldName := field.Name
			if jsonTag != "" && jsonTag != "-" {
				// 处理json标签（去掉omitempty等选项）
				if commaIdx := strings.Index(jsonTag, ","); commaIdx != -1 {
					fieldName = jsonTag[:commaIdx]
				} else {
					fieldName = jsonTag
				}
			}
			fieldTypes[fieldName] = field.Type
		}
	}

	for key, values := range c.Request.URL.Query() {
		if strings.HasPrefix(key, "filters[") && strings.HasSuffix(key, "]") {
			field := key[len("filters[") : len(key)-1]
			if len(values) > 0 {
				value := values[0]
				// 根据结构体字段类型来转换值
				if fieldType, exists := fieldTypes[field]; exists {
					convertedValue := convertValueByType(value, fieldType)
					filtersMap[field] = convertedValue
				}
			}
		}
	}

	if len(filtersMap) > 0 {
		filtersBytes, err := json.Marshal(filtersMap)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(filtersBytes, &filtersStructure); err != nil {
			return err
		}
	}

	p.Filters = filtersMap

	return nil
}

// convertValueByType 根据目标类型转换值
func convertValueByType(value string, targetType reflect.Type) interface{} {
	// 处理指针类型
	if targetType.Kind() == reflect.Ptr {
		if value == "" {
			return reflect.Zero(targetType).Interface()
		}
		elemType := targetType.Elem()
		elemValue := convertValueByType(value, elemType)
		ptrValue := reflect.New(elemType)
		if elemValue != nil {
			ptrValue.Elem().Set(reflect.ValueOf(elemValue).Convert(elemType))
		}
		return ptrValue.Interface()
	}

	switch targetType.Kind() {
	case reflect.String:
		return value
	case reflect.Bool:
		switch value {
		case "true":
			return true
		case "false":
			return false
		}
		return value
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		if intVal, err := strconv.ParseInt(value, 10, 64); err == nil {
			// 根据具体的int类型返回相应的值
			switch targetType.Kind() {
			case reflect.Int:
				return int(intVal)
			case reflect.Int8:
				return int8(intVal)
			case reflect.Int16:
				return int16(intVal)
			case reflect.Int32:
				return int32(intVal)
			case reflect.Int64:
				return intVal
			}
		}
		return value
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		if uintVal, err := strconv.ParseUint(value, 10, 64); err == nil {
			switch targetType.Kind() {
			case reflect.Uint:
				return uint(uintVal)
			case reflect.Uint8:
				return uint8(uintVal)
			case reflect.Uint16:
				return uint16(uintVal)
			case reflect.Uint32:
				return uint32(uintVal)
			case reflect.Uint64:
				return uintVal
			}
		}
		return value
	case reflect.Float32, reflect.Float64:
		if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
			if targetType.Kind() == reflect.Float32 {
				return float32(floatVal)
			}
			return floatVal
		}
		return value
	default:
		return value
	}
}
