/*
 * Copyright (C) 2013, 2014 Canonical, Ltd.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import QtQuick 2.2
import Ubuntu.Components 0.1
import Ubuntu.Gestures 0.1
import Unity 0.2
import Utils 0.1
import Unity.DashCommunicator 0.1
import "../Components"

Showable {
    id: dash
    objectName: "dash"

    visible: shown

    property string showScopeOnLoaded: "clickscope"

    DashCommunicatorService {
        objectName: "dashCommunicatorService"
        onSetCurrentScopeRequested: {
            if (!isSwipe || !window.active || bottomEdgeController.progress != 0) {
                if (bottomEdgeController.progress != 0 && window.active) animate = false;
                dash.setCurrentScope(scopeId, animate, isSwipe)
                if (bottomEdgeController.progress != 0) {
                    bottomEdgeController.enableAnimation = window.active;
                    bottomEdgeController.progress = 0;
                }
            }
        }
    }

    function setCurrentScope(scopeId, animate, reset) {
        var scopeIndex = -1;
        for (var i = 0; i < scopes.count; ++i) {
            if (scopes.getScope(i).id == scopeId) {
                scopeIndex = i;
                break;
            }
        }

        if (scopeIndex == -1) {
            console.warn("No match for scope with id: %1".arg(scopeId))
            return
        }

        closeOverlayScope();

        dashContent.closePreview();

        if (scopeIndex == dashContent.currentIndex && !reset) {
            // the scope is already the current one
            return
        }

        dashContent.setCurrentScopeAtIndex(scopeIndex, animate, reset)
    }

    function closeOverlayScope() {
        if (dashContent.x != 0) {
            dashContent.x = 0;
        }
    }

    Scopes {
        id: scopes
    }

    QtObject {
        id: bottomEdgeController
        objectName: "bottomEdgeController"

        property alias enableAnimation: progressAnimation.enabled
        property real progress: 0
        Behavior on progress {
            id: progressAnimation
            UbuntuNumberAnimation { }
        }
    }

    DashContent {
        id: dashContent

        objectName: "dashContent"
        width: dash.width
        height: dash.height
        scopes: scopes
        visible: x != -width && bottomEdgeController.progress != 1
        onGotoScope: {
            dash.setCurrentScope(scopeId, true, false);
        }
        onOpenScope: {
            scopeItem.scopeThatOpenedScope = currentScope;
            scopeItem.scope = scope;
            x = -width;
        }
        onScopeLoaded: {
            if (scopeId == dash.showScopeOnLoaded) {
                dash.setCurrentScope(scopeId, false, false)
                dash.showScopeOnLoaded = ""
            }
        }
        Behavior on x {
            UbuntuNumberAnimation {
                onRunningChanged: {
                    if (!running && dashContent.x == 0) {
                        scopeItem.scopeThatOpenedScope.closeScope(scopeItem.scope);
                        scopeItem.scope = null;
                    }
                }
            }
        }

        enabled: bottomEdgeController.progress == 0
    }

    Rectangle {
        color: "black"
        opacity: bottomEdgeController.progress
        anchors.fill: dashContent
    }

    ScopesList {
        id: scopesList
        objectName: "scopesList"
        width: dash.width
        height: dash.height
        scope: scopes.overviewScope
        y: dash.height * (1 - bottomEdgeController.progress)
        visible: bottomEdgeController.progress != 0
        onBackClicked: {
            bottomEdgeController.enableAnimation = true;
            bottomEdgeController.progress = 0;
        }
        onStoreClicked: {
            bottomEdgeController.enableAnimation = true;
            bottomEdgeController.progress = 0;
            dashContent.currentScope.performQuery("scope://com.canonical.scopes.clickstore");
        }
        onRequestFavorite: {
            scopes.setFavorite(scopeId, favorite);
        }
        onRequestFavoriteMoveTo: {
            scopes.moveFavoriteTo(scopeId, index);
        }

        Binding {
            target: scopesList.scope
            property: "isActive"
            value: bottomEdgeController.progress === 1
        }

        Connections {
            target: scopesList.scope
            onOpenScope: {
                bottomEdgeController.enableAnimation = true;
                bottomEdgeController.progress = 0;
                scopeItem.scopeThatOpenedScope = scopesList.scope;
                scopeItem.scope = scope;
                dashContent.x = -dashContent.width;
            }
            onGotoScope: {
                bottomEdgeController.enableAnimation = true;
                bottomEdgeController.progress = 0;
                dashContent.gotoScope(scopeId);
            }
        }
    }

    DashBackground
    {
        anchors.fill: scopeItem
        visible: scopeItem.visible
    }

    GenericScopeView {
        id: scopeItem
        objectName: "dashTempScopeItem"

        property var scopeThatOpenedScope: null

        x: dashContent.x + width
        y: dashContent.y
        width: parent.width
        height: parent.height
        visible: scope != null
        hasBackAction: true
        isCurrent: visible
        onBackClicked: {
            closeOverlayScope();
            closePreview();
        }

        Connections {
            target: scopeItem.scope
            onGotoScope: {
                dashContent.gotoScope(scopeId);
            }
            onOpenScope: {
                dashContent.openScope(scope);
            }
        }
    }

    Rectangle {
        id: indicator
        objectName: "processingIndicator"
        anchors {
            left: parent.left
            right: parent.right
            bottom: parent.bottom
            bottomMargin: Qt.inputMethod.keyboardRectangle.height
        }
        height: units.dp(3)
        color: scopeStyle.backgroundLuminance > 0.7 ? "#50000000" : "#50ffffff"
        opacity: 0
        visible: opacity > 0

        readonly property bool processing: dashContent.processing || scopeItem.processing || scopesList.processing

        Behavior on opacity {
            UbuntuNumberAnimation { duration: UbuntuAnimation.FastDuration }
        }

        onProcessingChanged: {
            if (processing) delay.start();
            else if (!persist.running) indicator.opacity = 0;
        }

        Timer {
            id: delay
            interval: 200
            onTriggered: if (indicator.processing) {
                persist.restart();
                indicator.opacity = 1;
            }
        }

        Timer {
            id: persist
            interval: 2 * UbuntuAnimation.SleepyDuration - UbuntuAnimation.FastDuration
            onTriggered: if (!indicator.processing) indicator.opacity = 0
        }

        Rectangle {
            id: orange
            anchors { top: parent.top;  bottom: parent.bottom }
            width: parent.width / 4
            color: Theme.palette.selected.foreground

            SequentialAnimation {
                running: indicator.visible
                loops: Animation.Infinite
                XAnimator {
                    from: -orange.width / 2
                    to: indicator.width - orange.width / 2
                    duration: UbuntuAnimation.SleepyDuration
                    easing.type: Easing.InOutSine
                    target: orange
                }
                XAnimator {
                    from: indicator.width - orange.width / 2
                    to: -orange.width / 2
                    duration: UbuntuAnimation.SleepyDuration
                    easing.type: Easing.InOutSine
                    target: orange
                }
            }
        }
    }

    Image {
        source: "graphics/overview_hint.png"
        anchors.horizontalCenter: parent.horizontalCenter
        opacity: (scopeItem.scope ? scopeItem.pageHeaderTotallyVisible : dashContent.pageHeaderTotallyVisible) &&
                 (overviewDragHandle.enabled || bottomEdgeController.progress != 0) ? 1 : 0
        Behavior on opacity {
            enabled: bottomEdgeController.progress == 0
            UbuntuNumberAnimation {}
        }
        y: parent.height - height * (1 - bottomEdgeController.progress * 4)
    }

    EdgeDragArea {
        id: overviewDragHandle
        objectName: "overviewDragHandle"
        z: 1
        direction: Direction.Upwards
        enabled: !dashContent.subPageShown &&
                  dashContent.currentScope &&
                  dashContent.currentScope.searchQuery == "" &&
                  !scopeItem.scope &&
                  (bottomEdgeController.progress == 0 || dragging)

        readonly property real fullMovement: dash.height

        anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
        height: units.gu(2)

        onSceneDistanceChanged: {
            bottomEdgeController.enableAnimation = false;
            bottomEdgeController.progress = Math.max(0, Math.min(1, sceneDistance / fullMovement));
        }

        onDraggingChanged: {
            bottomEdgeController.enableAnimation = true;
            bottomEdgeController.progress = (bottomEdgeController.progress > 0.3)  ? 1 : 0;
        }
    }

}
