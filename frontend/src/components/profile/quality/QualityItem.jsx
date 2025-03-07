import React, { useState } from 'react';
import QualityItemSingle from './QualityItemSingle';
import QualityItemGroup from './QualityItemGroup';

const QualityItem = (props) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const isGroup = 'qualities' in props.quality;
    
    const handleMouseEnter = (id) => {
        setHoveredItem(id);
    };
    
    const handleMouseLeave = () => {
        setHoveredItem(null);
    };
    
    // Add mouseEnter/Leave handlers and hoveredState to props
    const enhancedProps = {
        ...props,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        willBeSelected: hoveredItem === props.quality.id
    };
    
    if (isGroup) {
        return <QualityItemGroup {...enhancedProps} />;
    } else {
        return <QualityItemSingle {...enhancedProps} />;
    }
};

export default QualityItem;