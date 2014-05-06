/*
 * Copyright (C) 2014 Canonical, Ltd.
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

.pragma library

function cardString(template, components) {
    var code;
    code = 'AbstractButton { \
                id: root; \
                property var template; \
                property var components; \
                property var cardData; \
                property real fontScale: 1.0; \
                property int headerAlignment: Text.AlignLeft; \
                property int fixedHeaderHeight: -1; \
                property size fixedArtShapeSize: Qt.size(-1, -1); \
                readonly property string title: cardData && cardData["title"] || ""; \
                property bool asynchronous: true; \
                property bool showHeader: true; \
                implicitWidth: childrenRect.width; ';

    var hasArt = components["art"]["field"];
    var hasSummary = components["summary"] || false;
    var artAndSummary = hasArt && hasSummary;
    var isHorizontal = template["card-layout"] === "horizontal";
    var hasBackground = !isHorizontal && (template["card-background"] || components["background"] || artAndSummary);
    var hasTitle = components["title"] || false;
    var hasMascot = components["mascot"] || false;
    var inOverlay = hasArt && template && template["overlay"] === true && (hasTitle || hasMascot);
    var hasSubtitle = components["subtitle"] || false;
    var hasHeaderRow = hasMascot && hasTitle;

    if (hasBackground) {
        code += 'Loader {\
                    id: backgroundLoader; \
                    objectName: "backgroundLoader"; \
                    anchors.fill: parent; \
                    asynchronous: root.asynchronous; \
                    visible: status == Loader.Ready; \
                    sourceComponent: UbuntuShape { \
                        objectName: "background"; \
                        radius: "medium"; \
                        color: getColor(0) || "white"; \
                        gradientColor: getColor(1) || color; \
                        anchors.fill: parent; \
                        image: backgroundImage.source ? backgroundImage : null; \
                        property real luminance: 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b; \
                        property Image backgroundImage: Image { \
                            objectName: "backgroundImage"; \
                            source: { \
                                if (cardData && typeof cardData["background"] === "string") return cardData["background"]; \
                                else if (template && typeof template["card-background"] === "string") return template["card-background"]; \
                                else return ""; \
                            } \
                        } \
                        function getColor(index) { \
                            if (cardData && typeof cardData["background"] === "object" \
                                && (cardData["background"]["type"] === "color" || cardData["background"]["type"] === "gradient")) { \
                                return cardData["background"]["elements"][index]; \
                            } else if (template && typeof template["card-background"] === "object" \
                                    && (template["card-background"]["type"] === "color" || template["card-background"]["type"] === "gradient"))  { \
                                return template["card-background"]["elements"][index]; \
                            } else return undefined; \
                        } \
                    } \
                }';
    }

    if (hasArt) {
        code += 'readonly property size artShapeSize: artShapeLoader.item ? Qt.size(artShapeLoader.item.width, artShapeLoader.item.height) : Qt.size(-1, -1);'
        var imageWidthHeight;
        if (isHorizontal) {
            if (hasMascot || hasTitle) {
                imageWidthHeight = 'width: height * artShape.aspect; \
                                    height: headerHeight;'
            } else {
                // This side of the else is a bit silly, who wants an horizontal layout without mascot and title?
                // So we define a "random" height of the image height + 2 gu for the margins
                imageWidthHeight = 'width: height * artShape.aspect; \
                                    height: units.gu(7.625)';
            }
        } else {
            imageWidthHeight = 'width: root.width; \
                                height: width / artShape.aspect;'
        }
        code += 'Item  { \
                    id: artShapeHolder; \
                    height: root.fixedArtShapeSize.height != -1 ? root.fixedArtShapeSize.height : artShapeLoader.height; \
                    width: root.fixedArtShapeSize.width != -1 ? root.fixedArtShapeSize.width : artShapeLoader.width; \
                    ' + (isHorizontal ? 'anchors.left: parent.left;' : 'anchors.horizontalCenter: parent.horizontalCenter;' ) + '\
                    Loader { \
                        id: artShapeLoader; \
                        objectName: "artShapeLoader"; \
                        active: cardData && cardData["art"] || false; \
                        asynchronous: root.asynchronous; \
                        visible: status == Loader.Ready; \
                        sourceComponent: UbuntuShape { \
                            id: artShape; \
                            objectName: "artShape"; \
                            radius: "medium"; \
                            readonly property real aspect: components !== undefined ? components["art"]["aspect-ratio"] : 1; \
                            readonly property bool aspectSmallerThanImageAspect: aspect < image.aspect; \
                            Component.onCompleted: updateWidthHeightBindings(); \
                            onAspectSmallerThanImageAspectChanged: updateWidthHeightBindings(); \
                            visible: image.status == Image.Ready; \
                            function updateWidthHeightBindings() { \
                                if (aspectSmallerThanImageAspect) { \
                                    width = Qt.binding(function() { return !visible ? 0 : image.width }); \
                                    height = Qt.binding(function() { return !visible ? 0 : image.fillMode === Image.PreserveAspectCrop ? image.height : width / image.aspect }); \
                                } else { \
                                    width = Qt.binding(function() { return !visible ? 0 : image.fillMode === Image.PreserveAspectCrop ? image.width : height * image.aspect }); \
                                    height = Qt.binding(function() { return !visible ? 0 : image.height }); \
                                } \
                            } \
                            image: Image { \
                                objectName: "artImage"; \
                                source: cardData && cardData["art"] || ""; \
                                cache: true; \
                                asynchronous: root.asynchronous; \
                                fillMode: components && components["art"]["fill-mode"] === "fit" ? Image.PreserveAspectFit: Image.PreserveAspectCrop; \
                                readonly property real aspect: implicitWidth / implicitHeight; \
                                ' + imageWidthHeight + '\
                            } \
                        } \
                    } \
                }'
    } else {
        code += 'readonly property size artShapeSize: Qt.size(-1, -1);'
    }

    if (inOverlay) {
        var height = 'fixedHeaderHeight != -1 ? fixedHeaderHeight : headerHeight;';
        code += 'Loader { \
            id: overlayLoader; \
            anchors { \
                left: artShapeHolder.left; \
                right: artShapeHolder.right; \
                bottom: artShapeHolder.bottom; \
            } \
            active: artShapeLoader.active && artShapeLoader.item && artShapeLoader.item.image.status === Image.Ready || false; \
            asynchronous: root.asynchronous; \
            visible: showHeader && status == Loader.Ready; \
            sourceComponent: ShaderEffect { \
                id: overlay; \
                height: ' + height + ' \
                opacity: 0.6; \
                property var source: ShaderEffectSource { \
                    id: shaderSource; \
                    sourceItem: artShapeLoader.item; \
                    onVisibleChanged: if (visible) scheduleUpdate(); \
                    live: false; \
                    sourceRect: Qt.rect(0, artShapeLoader.height - overlay.height, artShapeLoader.width, overlay.height); \
                } \
                vertexShader: " \
                    uniform highp mat4 qt_Matrix; \
                    attribute highp vec4 qt_Vertex; \
                    attribute highp vec2 qt_MultiTexCoord0; \
                    varying highp vec2 coord; \
                    void main() { \
                        coord = qt_MultiTexCoord0; \
                        gl_Position = qt_Matrix * qt_Vertex; \
                    }"; \
                fragmentShader: " \
                    varying highp vec2 coord; \
                    uniform sampler2D source; \
                    uniform lowp float qt_Opacity; \
                    void main() { \
                        lowp vec4 tex = texture2D(source, coord); \
                        gl_FragColor = vec4(0, 0, 0, tex.a) * qt_Opacity; \
                    }"; \
            } \
        }';
    }

    var headerVerticalAnchors;
    if (inOverlay) {
        headerVerticalAnchors = 'anchors.bottom: artShapeHolder.bottom; \
                                 anchors.bottomMargin: units.gu(1);';
    } else {
        if (hasArt) {
            if (isHorizontal) {
                headerVerticalAnchors = 'anchors.top: artShapeHolder.top; \
                                         anchors.topMargin: units.gu(1);';
            } else {
                headerVerticalAnchors = 'anchors.top: artShapeHolder.bottom; \
                                         anchors.topMargin: units.gu(1);';
            }
        } else {
            headerVerticalAnchors = 'anchors.top: parent.top; \
                                     anchors.topMargin: units.gu(1);';
        }
    }
    var headerLeftAnchor;
    var headerLeftAnchorHasMagin = false;
    if (isHorizontal && hasArt) {
        headerLeftAnchor = 'anchors.left: artShapeHolder.right; \
                            anchors.leftMargin: units.gu(1);';
        headerLeftAnchorHasMagin = true;
    } else {
        headerLeftAnchor = 'anchors.left: parent.left;';
    }

    if (hasHeaderRow) {
        code += 'readonly property int headerHeight: row.height + row.margins * 2;'
        code += 'Row { \
                    id: row; \
                    objectName: "outerRow"; \
                    property real margins: units.gu(1); \
                    spacing: margins; \
                    ' + headerVerticalAnchors + '\
                    ' + headerLeftAnchor + '\
                    anchors.right: parent.right; \
                    anchors.margins: margins;';
    } else if (hasMascot) {
        code += 'readonly property int headerHeight: mascotImage.height + units.gu(1) * 2;'
    } else if (hasSubtitle) {
        code += 'readonly property int headerHeight: subtitleLabel.y + subtitleLabel.height - titleLabel.y + titleLabel.anchors.topMargin * 2 + subtitleLabel.anchors.topMargin;'
    } else if (hasTitle) {
        code += 'readonly property int headerHeight: titleLabel.height + titleLabel.anchors.topMargin * 2;'
    } else {
        code += 'readonly property int headerHeight: 0;'
    }

    if (hasMascot) {
        var useMascotShape = !hasBackground && !inOverlay;
        var anchors = "";
        if (!hasHeaderRow) {
            anchors += headerLeftAnchor;
            anchors += headerVerticalAnchors;
            if (!headerLeftAnchorHasMagin) {
                anchors += 'anchors.leftMargin: units.gu(1);'
            }
        } else {
            anchors = "anchors.verticalCenter: parent.verticalCenter;"
        }

        if (useMascotShape) {
            code += 'Loader { \
                        id: mascotShapeLoader; \
                        objectName: "mascotShapeLoader"; \
                        asynchronous: root.asynchronous; \
                        active: mascotImage.status === Image.Ready; \
                        visible: showHeader && active && status == Loader.Ready; \
                        width: units.gu(6); \
                        height: units.gu(5.625); \
                        sourceComponent: UbuntuShape { image: mascotImage } \
                        ' + anchors + '\
                    }';
        }

        code += 'Image { \
                    id: mascotImage; \
                    objectName: "mascotImage"; \
                    ' + anchors + '\
                    readonly property int maxSize: Math.max(width, height) * 4; \
                    source: cardData && cardData["mascot"]; \
                    width: units.gu(6); \
                    height: units.gu(5.625); \
                    sourceSize { width: maxSize; height: maxSize } \
                    fillMode: Image.PreserveAspectCrop; \
                    horizontalAlignment: Image.AlignHCenter; \
                    verticalAlignment: Image.AlignVCenter; \
                    visible: showHeader && ' + (useMascotShape ? 'false' : 'true') + '; \
                }';
    }

    var summaryColorWithBackground = 'backgroundLoader.active && backgroundLoader.item && backgroundLoader.item.luminance < 0.7 ? "white" : "grey"';

    if (hasTitle) {
        var color;
        if (inOverlay) {
            color = '"white"';
        } else if (hasSummary) {
            color = 'summary.color';
        } else if (hasBackground) {
            color = summaryColorWithBackground;
        } else {
            color = '"grey"';
        }

        var titleAnchors = "";
        var subtitleAnchors = "";
        if (hasMascot && hasSubtitle) {
            titleAnchors = 'anchors { left: parent.left; right: parent.right }';
            subtitleAnchors = titleAnchors;
            code += 'Column { \
                        anchors.verticalCenter: parent.verticalCenter; \
                        spacing: units.dp(2); \
                        width: parent.width - x;';
        } else if (hasMascot) {
            titleAnchors = 'anchors.verticalCenter: parent.verticalCenter;'
        } else if (inOverlay) {
            titleAnchors = 'anchors.left: parent.left; \
                            anchors.leftMargin: units.gu(1); \
                            anchors.right: parent.right; \
                            anchors.top: overlayLoader.top; \
                            anchors.topMargin: units.gu(1);';
            subtitleAnchors = 'anchors.left: titleLabel.left; \
                               anchors.leftMargin: titleLabel.leftMargin; \
                               anchors.right: titleLabel.right; \
                               anchors.top: titleLabel.bottom; \
                               anchors.topMargin: units.dp(2);';
        } else {
            titleAnchors = "anchors.right: parent.right;";
            if (hasMascot) {
                titleAnchors += 'anchors.left: mascotImage.right; \
                                 anchors.leftMargin: units.gu(1);';
            } else {
                titleAnchors += headerLeftAnchor;
            }
            titleAnchors += headerVerticalAnchors;
            subtitleAnchors = 'anchors.left: titleLabel.left; \
                               anchors.leftMargin: titleLabel.leftMargin; \
                               anchors.right: titleLabel.right; \
                               anchors.top: titleLabel.bottom; \
                               anchors.topMargin: units.dp(2);';
        }

        code += 'Label { \
                    id: titleLabel; \
                    objectName: "titleLabel"; \
                    ' + titleAnchors + '\
                    elide: Text.ElideRight; \
                    fontSize: "small"; \
                    wrapMode: Text.Wrap; \
                    maximumLineCount: 2; \
                    font.pixelSize: Math.round(FontUtils.sizeToPixels(fontSize) * fontScale); \
                    color: ' + color + '; \
                    visible: showHeader ' + (inOverlay ? '&& overlayLoader.active': '') + '; \
                    text: root.title; \
                    font.weight: components && components["subtitle"] ? Font.DemiBold : Font.Normal; \
                    horizontalAlignment: root.headerAlignment; \
                }';

        if (hasSubtitle) {
            code += 'Label { \
                        id: subtitleLabel; \
                        objectName: "subtitleLabel"; \
                        ' + subtitleAnchors + '\
                        elide: Text.ElideRight; \
                        fontSize: "small"; \
                        font.pixelSize: Math.round(FontUtils.sizeToPixels(fontSize) * fontScale); \
                        color: ' + color + '; \
                        visible: titleLabel.visible && titleLabel.text; \
                        text: cardData && cardData["subtitle"] || ""; \
                        font.weight: Font.Light; \
                        horizontalAlignment: root.headerAlignment; \
                    }';

            // Close Column
            if (hasMascot)
                code += '}';
        }
    }

    if (hasHeaderRow) {
        // Close Row
        code += '}';
    }

    if (hasSummary) {
        var summaryTopAnchor;
        if (isHorizontal && hasArt) summaryTopAnchor = "artShapeHolder.bottom";
        else if (inOverlay && hasArt) summaryTopAnchor = "artShapeHolder.bottom";
        else if (hasHeaderRow) summaryTopAnchor = "row.bottom";
        else if (hasMascot) summaryTopAnchor = "mascotImage.bottom";
        else if (hasSubtitle) summaryTopAnchor = "subtitleLabel.bottom";
        else if (hasTitle) summaryTopAnchor = "titleLabel.bottom";
        else if (hasArt) summaryTopAnchor = "artShapeHolder.bottom";
        else summaryTopAnchor = "parent.top";
        var color;
        if (hasBackground) {
            color = summaryColorWithBackground;
        } else {
            color = '"grey"';
        }
        code += 'Label { \
                    id: summary; \
                    objectName: "summaryLabel"; \
                    anchors { \
                        top: ' + summaryTopAnchor + '; \
                        left: parent.left; \
                        right: parent.right; \
                        margins: units.gu(1); \
                        topMargin: ' + (hasMascot || hasSubtitle ? 'anchors.margins' : 0) + '; \
                    } \
                    wrapMode: Text.Wrap; \
                    maximumLineCount: 5; \
                    elide: Text.ElideRight; \
                    text: cardData && cardData["summary"] || ""; \
                    height: text ? implicitHeight : 0; \
                    fontSize: "small"; \
                    color: ' + color + '; \
                }';
    }

    // Close the AbstractButton
    if (hasSummary) {
        code += 'implicitHeight: summary.y + summary.height + (summary.text ? units.gu(1) : 0);';
    } else if (hasHeaderRow) {
        code += 'implicitHeight: row.y + row.height + units.gu(1);';
    } else if (hasMascot) {
        code += 'implicitHeight: mascotImage.y + mascotImage.height;';
    } else if (hasSubtitle) {
        code += 'implicitHeight: subtitleLabel.y + subtitleLabel.height + units.gu(1);';
    } else if (hasTitle) {
        code += 'implicitHeight: titleLabel.y + titleLabel.height + units.gu(1);';
    }
    code += '}';

    return code;
}

function createCardComponent(parent, template, components) {
    var imports = 'import QtQuick 2.2; \
                   import Ubuntu.Components 0.1; \
                   import Ubuntu.Thumbnailer 0.1;';
    var card = cardString(template, components);
    var code = imports + 'Component {' + card + '}';
    return Qt.createQmlObject(code, parent, "createCardComponent");
}
