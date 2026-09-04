DiskVacuum — Product Goal

Goal

DiskVacuum is a fast, visual, cross-platform storage cleaner and disk analyzer.

Its purpose is to help users quickly understand what is taking up space, find files and caches they no longer need, and safely reclaim storage without manually digging through folders.

DiskVacuum should be a strong cross-platform alternative to apps like Reclaim, with a similarly clean, modern, visual experience while supporting more operating systems.

Platform Focus

Initial priority:

macOS

Linux

Next:

Windows

Later:

Android

The desktop versions should share the same overall product experience while adapting cleanup rules and system-specific features to each operating system.

Product Experience

DiskVacuum should feel simple enough for normal users while still being genuinely useful for developers and power users.

The UI should be highly visual, clean, modern, and easy to understand.

A user should be able to:

open DiskVacuum

scan a drive or folder

immediately see where their storage is going

explore large folders and files

discover unnecessary files, caches, duplicates, and leftovers

select what they want to remove

clearly see how much space will be recovered

safely clean it

The app should avoid overwhelming users with technical filesystem information unless they choose to explore deeper.

Core Features

Space Overview

Show an interactive visual overview of disk usage.

The user should be able to immediately understand which folders, applications, file types, or categories are consuming the most storage.

The visualization should make large storage consumers visually obvious.

Disk Explorer

Provide a file/folder explorer focused on storage usage.

Users should be able to:

browse folders

see folder sizes

sort by size

drill down into directories

identify unusually large folders

open locations in the system file manager

select files or folders for cleanup

Large Files

Automatically find unusually large files across the selected drive or folder.

Allow users to:

sort by size

filter by type

filter by location

preview basic file information

reveal the file in the system file manager

select multiple files for cleanup

Duplicate Finder

Find exact duplicate files based on file contents rather than only filenames.

Show duplicate groups clearly and help users decide which copy to keep.

Support bulk selection while avoiding accidental removal of every copy.

Developer Cleanup

Find storage commonly wasted by development projects and developer tools.

Examples include:

node_modules

build output

framework caches

Rust target directories

Python virtual environments and caches

package-manager caches

IDE caches

old project artifacts

Docker-related storage where safely detectable

Android development caches

Xcode development data on macOS

Items should be grouped by project or tool so users understand what they are deleting.

AI Cache & Models

Find storage used by local AI and coding tools.

Examples may include:

local model files

model caches

downloaded weights

generated caches

logs

temporary files

Show storage grouped by application or tool.

App Leftovers

Find files left behind by applications that are no longer installed.

Examples include:

caches

logs

preferences

application support data

temporary files

abandoned application directories

DiskVacuum should clearly distinguish between confirmed leftovers and files it is less certain about.

System & App Caches

Find removable caches and temporary data created by the operating system and installed applications.

Cleanup suggestions should explain what the data is and whether deleting it may cause the application to regenerate it later.

Global Search

Provide fast search across scanned files and folders.

Users should be able to search by:

filename

folder

extension

category

application/tool

storage size

Storage Categories

Group storage into understandable categories such as:

Applications

Documents

Downloads

Images

Videos

Audio

Archives

Developer Files

AI Models & Caches

Application Caches

System Data

Duplicates

Other

System Overview

Show useful high-level system information such as:

total disk size

used storage

available storage

storage reclaimed with DiskVacuum

major storage categories

CPU and memory information can also be shown if it improves the overall system dashboard.

Cleanup Review

Before cleaning anything, show a clear review screen containing:

selected items

number of files/folders

total size

cleanup categories

potentially risky selections

estimated storage to reclaim

The user should always know exactly what DiskVacuum is about to remove.

Safe Cleanup

Safety is a core product requirement.

DiskVacuum should:

prefer moving files to Trash / Recycle Bin instead of permanently deleting them

protect critical system paths

prevent dangerous bulk deletions

warn about potentially important files

require confirmation before cleanup

make risky cleanup suggestions visibly different from safe ones

never silently delete user files

Scan Controls

Users should be able to:

scan an entire drive

scan a specific folder

cancel a scan

rescan

exclude folders

exclude file types

ignore selected paths in future scans

Cleanup Results

After cleanup, show:

how much storage was recovered

what categories were cleaned

current free storage

before/after storage usage

The result should make the benefit immediately visible.

Platform-Specific Cleanup

DiskVacuum should understand that each operating system stores junk, caches, applications, and user data differently.

macOS

Focus on areas such as:

application caches

Application Support data

logs

app leftovers

developer caches

Xcode data

package-manager caches

downloaded installers

Trash

large hidden files

Linux

Support common Linux storage sources such as:

user caches

logs

package-manager caches

Flatpak data

Snap data

development files

old application data

temporary files

Trash

Linux behavior should account for differences between distributions rather than assuming every Linux system is identical.

Windows

When Windows support is added, include areas such as:

temporary files

application caches

AppData storage

application leftovers

developer caches

downloaded installers

Recycle Bin

large hidden files

other safe-to-clean Windows storage

Android — Later

Android support can eventually focus on:

large files

Downloads

duplicate files

media storage

application-generated files accessible to the user

old APKs

temporary files and caches where Android permissions allow access

Android does not need to match every desktop feature exactly.

UX Direction

DiskVacuum should have the same general appeal that makes Reclaim attractive:

visual instead of technical

minimal instead of cluttered

fast to understand

large, clear storage numbers

interactive storage visualization

simple navigation

obvious cleanup actions

useful defaults

polished animations and transitions

clear distinction between safe and potentially risky cleanup

The interface can be strongly inspired by Reclaim's overall simplicity and presentation, while DiskVacuum should maintain its own identity and visual details.

Primary Differentiators

DiskVacuum should eventually stand out through:

macOS + Linux + Windows support

strong developer cleanup

AI model/cache cleanup

visual disk exploration

safe cleanup

fast large-file discovery

duplicate detection

useful app-leftover detection

one consistent storage-cleaning experience across operating systems

Initial Product Scope

The first usable version should focus on macOS and Linux.

The most important initial experience is:

Scan → Understand storage → Explore → Find waste → Review → Clean safely

The first release does not need every advanced cleanup rule.

It should first make these features excellent:

Space Overview

Disk Explorer

Large Files

Developer Cleanup

basic cache detection

Global Search

safe file cleanup

cleanup review and results

After those are stable, expand into:

Duplicate Finder

AI Cache & Models

App Leftovers

deeper OS-specific cleanup

Windows support

Android support

Product Principle

DiskVacuum should answer one question extremely well:

What's eating my storage, and what can I safely get rid of?

Everything in the product should support that goal.
