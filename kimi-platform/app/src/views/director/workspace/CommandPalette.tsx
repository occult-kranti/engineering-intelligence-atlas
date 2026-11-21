import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

export interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  group?: string;
  run(): void;
}

/** ⌘K / Ctrl+K palette. Commands are supplied by the workspace shell so the
 * palette never invents actions the current state cannot perform. */
export default function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  commands: PaletteCommand[];
}) {
  const groups = [...new Set(commands.map((c) => c.group ?? "Actions"))];
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Director command palette"
      description="Jump to a stage, focus the approvals inbox, or run a control action."
    >
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup heading={g} key={g}>
            {commands
              .filter((c) => (c.group ?? "Actions") === g)
              .map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.label}
                  onSelect={() => {
                    onOpenChange(false);
                    c.run();
                  }}
                >
                  {c.label}
                  {c.shortcut ? <CommandShortcut>{c.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
