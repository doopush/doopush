import { type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  type NavCollapsible,
  type NavItem,
  type NavLink,
  type NavGroup as NavGroupProps,
} from './types'

export function NavGroup({ title, items }: NavGroupProps) {
  const { state, isMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url}`

          if (!item.items)
            return <SidebarMenuLink key={key} item={item} href={href} />

          if (state === 'collapsed' && !isMobile)
            return (
              <SidebarMenuCollapsedDropdown key={key} item={item} href={href} />
            )

          return <SidebarMenuCollapsible key={key} item={item} href={href} />
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
}

function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { setOpenMobile } = useSidebar()
  const isExternal = item.external || (typeof item.url === 'string' && item.url.startsWith('http'))
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={!isExternal && checkIsActive(href, item)}
        tooltip={item.title}
      >
        {isExternal ? (
          <a 
            href={item.url as string} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={() => setOpenMobile(false)}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
          </a>
        ) : (
          <Link to={item.url} onClick={() => setOpenMobile(false)}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <Collapsible
      asChild
      defaultOpen={checkIsActive(href, item, true)}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub className='gap-1.5 py-1.5'>
            {item.items.map((subItem) => {
              const isExternal = subItem.external || (typeof subItem.url === 'string' && subItem.url.startsWith('http'))
              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={!isExternal && checkIsActive(href, subItem)}
                  >
                    {isExternal ? (
                      <a 
                        href={subItem.url as string} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => setOpenMobile(false)}
                      >
                        {subItem.icon && <subItem.icon />}
                        <span>{subItem.title}</span>
                        {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                      </a>
                    ) : (
                      <Link to={subItem.url} onClick={() => setOpenMobile(false)}>
                        {subItem.icon && <subItem.icon />}
                        <span>{subItem.title}</span>
                        {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                      </Link>
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={checkIsActive(href, item)}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => {
            const isExternal = sub.external || (typeof sub.url === 'string' && sub.url.startsWith('http'))
            return (
              <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
                {isExternal ? (
                  <a
                    href={sub.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
                  >
                    {sub.icon && <sub.icon />}
                    <span className='max-w-52 text-wrap'>{sub.title}</span>
                    {sub.badge && (
                      <span className='ms-auto text-xs'>{sub.badge}</span>
                    )}
                  </a>
                ) : (
                  <Link
                    to={sub.url}
                    className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
                  >
                    {sub.icon && <sub.icon />}
                    <span className='max-w-52 text-wrap'>{sub.title}</span>
                    {sub.badge && (
                      <span className='ms-auto text-xs'>{sub.badge}</span>
                    )}
                  </Link>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item: NavItem, mainNav = false) {
  return (
    href === item.url || // /endpint?search=param
    href.split('?')[0] === item.url || // endpoint
    !!item?.items?.filter((i) => i.url === href).length || // if child nav is active
    (mainNav &&
      href.split('/')[1] !== '' &&
      href.split('/')[1] === item?.url?.split('/')[1])
  )
}
