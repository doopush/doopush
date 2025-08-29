/* eslint-disable react-refresh/only-export-components */
'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

// 默认分页数据
export const defaultPagination = {
  current_page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
};

// 默认每页条数选项
export const defaultPageSizeOptions = [10, 20, 50, 100, 200];

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showQuickJumper?: boolean;
  showSizeChanger?: boolean;
  showTotal?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = defaultPageSizeOptions,
  showQuickJumper = true,
  showSizeChanger = true,
  showTotal = true,
  className = '',
}: PaginationProps) {
  const [jumpPage, setJumpPage] = useState('');

  // 如果pageSizeOptions不包含pageSize，则添加到pageSizeOptions中
  if (!pageSizeOptions.includes(pageSize)) {
    pageSizeOptions.push(pageSize);
    pageSizeOptions.sort((a, b) => a - b);
  }

  // 计算显示的页码范围
  const getVisiblePages = () => {
    const delta = 2; // 当前页前后显示的页数
    const range = [];
    const rangeWithDots = [];

    // 计算显示范围
    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    // 添加第一页
    if (start > 2) {
      rangeWithDots.push(1, '...');
    } else if (start === 2) {
      rangeWithDots.push(1);
    } else {
      rangeWithDots.push(1);
    }

    // 添加中间页码
    rangeWithDots.push(...range);

    // 添加最后一页
    if (end < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (end === totalPages - 1) {
      rangeWithDots.push(totalPages);
    } else if (totalPages > 1) {
      // 如果总页数大于1且end等于totalPages，说明最后一页已经包含在range中了
      if (!range.includes(totalPages)) {
        rangeWithDots.push(totalPages);
      }
    }

    return rangeWithDots;
  };

  const handleJumpToPage = () => {
    const page = parseInt(jumpPage);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpPage('');
    }
  };

  const visiblePages = getVisiblePages();

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {/* 总数信息 */}
      {showTotal && (
        <div className="text-muted-foreground text-sm">
          共 {totalItems} 条记录，第 {currentPage} / {totalPages} 页
        </div>
      )}

      {/* 分页控件 */}
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        {/* 每页条数选择器 */}
        {showSizeChanger && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">每页</span>
            <Select value={pageSize.toString()} onValueChange={value => onPageSizeChange(parseInt(value))}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map(size => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">条</span>
          </div>
        )}

        {/* 页码导航 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* 首页按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="hidden sm:flex"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* 上一页按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* 页码按钮 */}
            <div className="flex items-center gap-1">
              {visiblePages.map((page, index) => (
                <div key={index}>
                  {page === '...' ? (
                    <span className="text-muted-foreground px-2 py-1">...</span>
                  ) : (
                    <Button
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(page as number)}
                      className="h-8 w-8 p-0"
                    >
                      {page}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* 下一页按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* 末页按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="hidden sm:flex"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 快速跳转 */}
        {showQuickJumper && totalPages > 5 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">跳转</span>
            <Input
              type="number"
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleJumpToPage();
                }
              }}
              placeholder="页码"
              className="h-8 w-16"
              min={1}
              max={totalPages}
            />
            <Button size="sm" onClick={handleJumpToPage} disabled={!jumpPage}>
              确定
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// 分页Hook，方便在组件中使用
export function usePagination(initialPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const resetPagination = () => {
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 改变每页条数时重置到第一页
  };

  return {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    handlePageSizeChange,
    resetPagination,
  };
}

// 计算分页数据的工具函数
export function calculatePagination(totalItems: number, currentPage: number, pageSize: number) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (currentPage - 1) * pageSize;
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return {
    totalPages,
    offset,
    hasNextPage,
    hasPrevPage,
    currentPage: Math.min(currentPage, totalPages), // 确保当前页不超过总页数
  };
}
